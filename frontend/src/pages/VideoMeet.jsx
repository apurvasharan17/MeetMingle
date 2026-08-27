import React, { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import io from "socket.io-client";

import VideocamIcon from "@mui/icons-material/Videocam";
import VideocamOffIcon from "@mui/icons-material/VideocamOff";
import CallEndIcon from "@mui/icons-material/CallEnd";
import MicIcon from "@mui/icons-material/Mic";
import MicOffIcon from "@mui/icons-material/MicOff";
import ScreenShareIcon from "@mui/icons-material/ScreenShare";
import StopScreenShareIcon from "@mui/icons-material/StopScreenShare";
import ChatIcon from "@mui/icons-material/Chat";
import CloseIcon from "@mui/icons-material/Close";

import styles from "../styles/videoComponent.module.css";
import server from "../environment";

// A public STUN server is enough for peers on simple NATs, but roughly 15-20%
// of real-world connections need a TURN relay (symmetric NAT, corporate
// firewalls, some mobile carriers). Set the REACT_APP_TURN_* variables to add
// one — without it those users see a black tile and never connect.
const peerConfig = {
  iceServers: [
    { urls: "stun:stun.l.google.com:19302" },
    ...(process.env.REACT_APP_TURN_URL
      ? [
          {
            urls: process.env.REACT_APP_TURN_URL,
            username: process.env.REACT_APP_TURN_USERNAME,
            credential: process.env.REACT_APP_TURN_CREDENTIAL,
          },
        ]
      : []),
  ],
};

const initials = (name) =>
  (name || "?")
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();

export default function VideoMeetComponent() {
  const { url: roomId } = useParams();
  const navigate = useNavigate();

  const socketRef = useRef(null);
  const socketIdRef = useRef(null);
  const localVideoRef = useRef(null);
  const lobbyVideoRef = useRef(null);
  const localStreamRef = useRef(null);
  const screenStreamRef = useRef(null);
  const logRef = useRef(null);

  // socketId -> { pc, pendingCandidates: [] }
  const peersRef = useRef({});

  const [remoteStreams, setRemoteStreams] = useState([]);
  const [peers, setPeers] = useState({}); // socketId -> { name, audio, video }
  const [inLobby, setInLobby] = useState(true);
  const [username, setUsername] = useState("");

  const [videoEnabled, setVideoEnabled] = useState(true);
  const [audioEnabled, setAudioEnabled] = useState(true);
  const [sharingScreen, setSharingScreen] = useState(false);
  const [screenAvailable, setScreenAvailable] = useState(false);

  const [showChat, setShowChat] = useState(false);
  const [messages, setMessages] = useState([]);
  const [message, setMessage] = useState("");
  const [unreadCount, setUnreadCount] = useState(0);

  const [toast, setToast] = useState("");

  /* ------------------------------------------------------------------ */
  /* Local media                                                         */
  /* ------------------------------------------------------------------ */

  // Runs exactly once. The original had no dependency array, so it re-ran on
  // every render and re-requested the camera each time.
  useEffect(() => {
    let cancelled = false;

    const init = async () => {
      setScreenAvailable(Boolean(navigator.mediaDevices?.getDisplayMedia));

      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: true,
        });

        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }

        localStreamRef.current = stream;
        [lobbyVideoRef, localVideoRef].forEach((ref) => {
          if (ref.current) ref.current.srcObject = stream;
        });
      } catch (e) {
        setToast("Camera and microphone are blocked. Allow access in your browser, then reload.");
      }
    };

    init();
    return () => {
      cancelled = true;
    };
  }, []);

  // Re-attach the stream whenever the video element remounts (leaving the
  // lobby swaps in a different element).
  useEffect(() => {
    const ref = inLobby ? lobbyVideoRef : localVideoRef;
    if (ref.current && localStreamRef.current && !screenStreamRef.current) {
      ref.current.srcObject = localStreamRef.current;
    }
  }, [inLobby]);

  useEffect(() => {
    if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight;
  }, [messages, showChat]);

  /* ------------------------------------------------------------------ */
  /* Peer connections                                                    */
  /* ------------------------------------------------------------------ */

  const removePeer = useCallback((peerId) => {
    const peer = peersRef.current[peerId];
    if (peer) {
      peer.pc.onicecandidate = null;
      peer.pc.ontrack = null;
      peer.pc.onconnectionstatechange = null;
      peer.pc.close();
      delete peersRef.current[peerId];
    }
    setRemoteStreams((prev) => prev.filter((r) => r.socketId !== peerId));
    setPeers((prev) => {
      const next = { ...prev };
      delete next[peerId];
      return next;
    });
  }, []);

  const createPeerConnection = useCallback(
    (peerId) => {
      // The original rebuilt every peer connection each time anyone joined,
      // which dropped the calls that were already running.
      if (peersRef.current[peerId]) return peersRef.current[peerId].pc;

      const pc = new RTCPeerConnection(peerConfig);
      peersRef.current[peerId] = { pc, pendingCandidates: [] };

      pc.onicecandidate = (event) => {
        if (event.candidate) {
          socketRef.current?.emit("signal", peerId, JSON.stringify({ ice: event.candidate }));
        }
      };

      // ontrack replaces the removed onaddstream API.
      pc.ontrack = (event) => {
        const [stream] = event.streams;
        if (!stream) return;

        setRemoteStreams((prev) =>
          prev.some((r) => r.socketId === peerId)
            ? prev.map((r) => (r.socketId === peerId ? { ...r, stream } : r))
            : [...prev, { socketId: peerId, stream }]
        );
      };

      pc.onconnectionstatechange = () => {
        if (pc.connectionState === "failed" || pc.connectionState === "closed") {
          removePeer(peerId);
        }
      };

      // addTrack replaces the deprecated addStream.
      if (localStreamRef.current) {
        localStreamRef.current
          .getTracks()
          .forEach((track) => pc.addTrack(track, localStreamRef.current));
      }

      return pc;
    },
    [removePeer]
  );

  const handleSignal = useCallback(
    async (fromId, rawMessage) => {
      if (fromId === socketIdRef.current) return;

      let signal;
      try {
        signal = JSON.parse(rawMessage);
      } catch {
        return;
      }

      createPeerConnection(fromId);
      const entry = peersRef.current[fromId];
      if (!entry) return;
      const { pc } = entry;

      try {
        if (signal.sdp) {
          await pc.setRemoteDescription(new RTCSessionDescription(signal.sdp));

          // Candidates that arrive before the remote description is set would
          // otherwise be thrown away, which shows up as a call that connects
          // for some participants and silently fails for others.
          for (const candidate of entry.pendingCandidates) {
            await pc.addIceCandidate(new RTCIceCandidate(candidate));
          }
          entry.pendingCandidates = [];

          if (signal.sdp.type === "offer") {
            const answer = await pc.createAnswer();
            await pc.setLocalDescription(answer);
            socketRef.current?.emit(
              "signal",
              fromId,
              JSON.stringify({ sdp: pc.localDescription })
            );
          }
        }

        if (signal.ice) {
          if (pc.remoteDescription && pc.remoteDescription.type) {
            await pc.addIceCandidate(new RTCIceCandidate(signal.ice));
          } else {
            entry.pendingCandidates.push(signal.ice);
          }
        }
      } catch (e) {
        console.error("Signalling error with", fromId, e);
      }
    },
    [createPeerConnection]
  );

  const addChatMessage = useCallback((data, sender, senderSocketId) => {
    setMessages((prev) => [...prev, { sender, data, mine: senderSocketId === socketIdRef.current }]);
    if (senderSocketId !== socketIdRef.current) {
      setUnreadCount((prev) => prev + 1);
    }
  }, []);

  const connectToSocketServer = useCallback(
    (displayName) => {
      const socket = io(server, { transports: ["websocket", "polling"] });
      socketRef.current = socket;

      socket.on("connect", () => {
        socketIdRef.current = socket.id;
        // Uses the route param, not window.location.href — the full URL meant
        // /room and /room?x=1 were treated as two different rooms.
        socket.emit("join-call", roomId, displayName);
      });

      socket.on("connect_error", () =>
        setToast("Can't reach the meeting server. Check your connection.")
      );

      socket.on("room-full", ({ max }) => {
        setToast(`This room is full — it holds ${max} people.`);
        navigate("/home");
      });

      socket.on("signal", handleSignal);
      socket.on("chat-message", addChatMessage);
      socket.on("user-left", (id) => removePeer(id));

      // Names and mute state for everyone in the room.
      socket.on("participants", (list) => {
        setPeers((prev) => {
          const next = {};
          list.forEach((p) => {
            if (p.id === socketIdRef.current) return;
            next[p.id] = { name: p.name, ...(prev[p.id] || {}), ...(p.state || {}) };
          });
          return next;
        });
      });

      socket.on("media-state", (id, state) => {
        setPeers((prev) => ({ ...prev, [id]: { ...(prev[id] || {}), ...state } }));
      });

      socket.on("user-joined", (joinedId, clients) => {
        if (joinedId === socketIdRef.current) {
          // We just arrived: open a connection to everyone already here and
          // wait for their offers. Only one side offers, which avoids the
          // glare that broke the old code once a third participant joined.
          clients
            .filter((id) => id !== socketIdRef.current)
            .forEach((id) => createPeerConnection(id));
          return;
        }

        // Someone else arrived: we send them the offer.
        const pc = createPeerConnection(joinedId);
        pc.createOffer()
          .then((offer) => pc.setLocalDescription(offer))
          .then(() => {
            socket.emit("signal", joinedId, JSON.stringify({ sdp: pc.localDescription }));
          })
          .catch((e) => console.error("Offer failed", e));
      });
    },
    [roomId, handleSignal, addChatMessage, createPeerConnection, removePeer, navigate]
  );

  /* ------------------------------------------------------------------ */
  /* Teardown                                                            */
  /* ------------------------------------------------------------------ */

  const cleanup = useCallback(() => {
    Object.keys(peersRef.current).forEach((id) => {
      peersRef.current[id].pc.close();
      delete peersRef.current[id];
    });

    socketRef.current?.disconnect();
    socketRef.current = null;

    localStreamRef.current?.getTracks().forEach((t) => t.stop());
    screenStreamRef.current?.getTracks().forEach((t) => t.stop());
    localStreamRef.current = null;
    screenStreamRef.current = null;
  }, []);

  // Without this the camera light stays on and the socket stays open after
  // the component unmounts.
  useEffect(() => cleanup, [cleanup]);

  /* ------------------------------------------------------------------ */
  /* Controls                                                            */
  /* ------------------------------------------------------------------ */

  const connect = () => {
    const name = username.trim();
    if (!name) {
      setToast("Add a name so people know who joined.");
      return;
    }
    setInLobby(false);
    connectToSocketServer(name);
  };

  const broadcastState = (state) => socketRef.current?.emit("media-state", state);

  // Flipping track.enabled is instant and needs no renegotiation. The old code
  // tore down and re-acquired the whole stream on every mute click.
  const toggleVideo = () => {
    const track = localStreamRef.current?.getVideoTracks()[0];
    if (!track) return;
    track.enabled = !track.enabled;
    setVideoEnabled(track.enabled);
    broadcastState({ video: track.enabled });
  };

  const toggleAudio = () => {
    const track = localStreamRef.current?.getAudioTracks()[0];
    if (!track) return;
    track.enabled = !track.enabled;
    setAudioEnabled(track.enabled);
    broadcastState({ audio: track.enabled });
  };

  // replaceTrack swaps the outgoing video without renegotiating, so remote
  // peers see the screen immediately and see the camera again when it stops.
  const replaceOutgoingVideoTrack = (track) => {
    Object.values(peersRef.current).forEach(({ pc }) => {
      const sender = pc.getSenders().find((s) => s.track?.kind === "video");
      if (sender) sender.replaceTrack(track);
    });
  };

  const stopScreenShare = useCallback(() => {
    screenStreamRef.current?.getTracks().forEach((t) => t.stop());
    screenStreamRef.current = null;

    const cameraTrack = localStreamRef.current?.getVideoTracks()[0] || null;
    replaceOutgoingVideoTrack(cameraTrack);
    if (localVideoRef.current) localVideoRef.current.srcObject = localStreamRef.current;
    setSharingScreen(false);
  }, []);

  const toggleScreenShare = async () => {
    if (sharingScreen) {
      stopScreenShare();
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: true,
        audio: false,
      });
      screenStreamRef.current = stream;

      const screenTrack = stream.getVideoTracks()[0];
      replaceOutgoingVideoTrack(screenTrack);
      if (localVideoRef.current) localVideoRef.current.srcObject = stream;
      setSharingScreen(true);

      // Fires when the user clicks the browser's own "Stop sharing" bar.
      screenTrack.onended = () => stopScreenShare();
    } catch (e) {
      // User dismissed the picker — nothing worth surfacing.
    }
  };

  const handleEndCall = () => {
    cleanup();
    navigate("/home");
  };

  const sendMessage = () => {
    const trimmed = message.trim();
    if (!trimmed || !socketRef.current) return;
    socketRef.current.emit("chat-message", trimmed, username);
    setMessage("");
  };

  const toggleChat = () => {
    setShowChat((open) => {
      if (!open) setUnreadCount(0);
      return !open;
    });
  };

  /* ------------------------------------------------------------------ */
  /* Lobby                                                               */
  /* ------------------------------------------------------------------ */

  if (inLobby) {
    return (
      <div className={styles.lobby}>
        <div className={styles.lobbyCard}>
          <div>
            <p className={styles.eyebrow}>Ready to join</p>
            <h1 className={styles.lobbyTitle}>Check yourself before you go in</h1>
            <p className={styles.lobbyRoom}>
              Room <code>{roomId}</code>
            </p>
          </div>

          <div className={styles.preview}>
            <video ref={lobbyVideoRef} autoPlay muted playsInline />
            {!videoEnabled && <div className={styles.previewOff}>Camera is off</div>}

            <div className={styles.previewControls}>
              <button
                type="button"
                onClick={toggleAudio}
                className={`${styles.ctrl} ${audioEnabled ? "" : styles.ctrlOff}`}
                aria-label={audioEnabled ? "Turn off microphone" : "Turn on microphone"}
              >
                {audioEnabled ? <MicIcon /> : <MicOffIcon />}
              </button>
              <button
                type="button"
                onClick={toggleVideo}
                className={`${styles.ctrl} ${videoEnabled ? "" : styles.ctrlOff}`}
                aria-label={videoEnabled ? "Turn off camera" : "Turn on camera"}
              >
                {videoEnabled ? <VideocamIcon /> : <VideocamOffIcon />}
              </button>
            </div>
          </div>

          <div className={styles.lobbyForm}>
            <input
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && connect()}
              placeholder="Your name"
              aria-label="Your name"
              maxLength={40}
            />
            <button type="button" className={styles.join} onClick={connect}>
              Join call
            </button>
          </div>
        </div>

        {toast && <div className={styles.toast}>{toast}</div>}
      </div>
    );
  }

  /* ------------------------------------------------------------------ */
  /* Call                                                                */
  /* ------------------------------------------------------------------ */

  const tileCount = remoteStreams.length + 1;

  return (
    <div className={`${styles.shell} ${showChat ? styles.chatOpen : ""}`}>
      <div className={styles.stageWrap}>
        <div className={styles.stage} data-count={tileCount}>
          {remoteStreams.length === 0 && (
            <div className={styles.empty}>
              <strong>You're the only one here</strong>
              <span>Share the room link and they'll drop straight in.</span>
            </div>
          )}

          {remoteStreams.map((remote) => {
            const peer = peers[remote.socketId] || {};
            const name = peer.name || "Guest";
            return (
              <div key={remote.socketId} className={styles.tile}>
                <video
                  data-socket={remote.socketId}
                  ref={(el) => {
                    if (el && el.srcObject !== remote.stream) el.srcObject = remote.stream;
                  }}
                  autoPlay
                  playsInline
                />
                {peer.video === false && <div className={styles.avatar}>{initials(name)}</div>}
                <div className={styles.nameTag}>
                  {peer.audio === false && (
                    <span className={styles.mutedDot}>
                      <MicOffIcon />
                    </span>
                  )}
                  {name}
                </div>
              </div>
            );
          })}

          <div className={`${styles.tile} ${styles.selfTile} ${styles.pip}`}>
            <video ref={localVideoRef} autoPlay muted playsInline />
            {!videoEnabled && !sharingScreen && (
              <div className={styles.avatar}>{initials(username)}</div>
            )}
            <div className={styles.nameTag}>
              {!audioEnabled && (
                <span className={styles.mutedDot}>
                  <MicOffIcon />
                </span>
              )}
              {sharingScreen ? "Your screen" : "You"}
            </div>
          </div>
        </div>

        <div className={styles.bar}>
          <button
            type="button"
            onClick={toggleAudio}
            className={`${styles.ctrl} ${audioEnabled ? "" : styles.ctrlOff}`}
            aria-label={audioEnabled ? "Turn off microphone" : "Turn on microphone"}
          >
            {audioEnabled ? <MicIcon /> : <MicOffIcon />}
          </button>

          <button
            type="button"
            onClick={toggleVideo}
            className={`${styles.ctrl} ${videoEnabled ? "" : styles.ctrlOff}`}
            aria-label={videoEnabled ? "Turn off camera" : "Turn on camera"}
          >
            {videoEnabled ? <VideocamIcon /> : <VideocamOffIcon />}
          </button>

          {screenAvailable && (
            <button
              type="button"
              onClick={toggleScreenShare}
              className={`${styles.ctrl} ${sharingScreen ? styles.ctrlActive : ""}`}
              aria-label={sharingScreen ? "Stop sharing screen" : "Share screen"}
            >
              {sharingScreen ? <StopScreenShareIcon /> : <ScreenShareIcon />}
            </button>
          )}

          <button
            type="button"
            onClick={toggleChat}
            className={`${styles.ctrl} ${styles.badge} ${showChat ? styles.ctrlActive : ""}`}
            data-count={unreadCount}
            aria-label="Toggle chat"
          >
            <ChatIcon />
          </button>

          <span className={styles.divider} />

          <button
            type="button"
            onClick={handleEndCall}
            className={`${styles.ctrl} ${styles.hangup}`}
            aria-label="Leave call"
          >
            <CallEndIcon />
          </button>
        </div>

        {toast && <div className={styles.toast}>{toast}</div>}
      </div>

      {showChat && (
        <button
          type="button"
          className={styles.scrim}
          onClick={toggleChat}
          aria-label="Close chat"
        />
      )}

      {showChat && (
        <aside className={styles.chat}>
          <span className={styles.grip} aria-hidden="true" />

          <div className={styles.chatHead}>
            <h2>Chat</h2>
            <button
              type="button"
              className={styles.chatClose}
              onClick={toggleChat}
              aria-label="Close chat"
            >
              <CloseIcon fontSize="small" />
            </button>
          </div>

          <div className={styles.log} ref={logRef}>
            {messages.length === 0 && (
              <p className={styles.logEmpty}>No messages yet. Say hello.</p>
            )}

            {messages.map((item, index) => (
              <div
                key={index}
                className={`${styles.msg} ${item.mine ? styles.mine : ""}`}
              >
                <span className={styles.msgWho}>{item.mine ? "You" : item.sender}</span>
                <p>{item.data}</p>
              </div>
            ))}
          </div>

          <div className={styles.composer}>
            <input
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && sendMessage()}
              placeholder="Message the room"
              aria-label="Message the room"
              maxLength={2000}
            />
            <button
              type="button"
              className={styles.send}
              onClick={sendMessage}
              disabled={!message.trim()}
            >
              Send
            </button>
          </div>
        </aside>
      )}
    </div>
  );
}