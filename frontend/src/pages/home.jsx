import React, { useContext, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";

import withAuth from "../utils/withAuth";
import { AuthContext } from "../contexts/AuthContext";
import "../App.css";

// Ambiguous characters left out, so a code read aloud or copied off a
// screen doesn't turn into a different room.
const ALPHABET = "abcdefghjkmnpqrstuvwxyz23456789";

const chunk = (length) =>
    Array.from(
        { length },
        () => ALPHABET[Math.floor(Math.random() * ALPHABET.length)]
    ).join("");

// Grouped like a phone number — easier to read back to someone than a
// single run of characters. Still matches the backend's code pattern.
const newMeetingCode = () => `${chunk(3)}-${chunk(4)}-${chunk(3)}`;

function HomeComponent() {
    const navigate = useNavigate();
    const linkRef = useRef(null);

    const [meetingCode, setMeetingCode] = useState("");
    const [error, setError] = useState("");
    const [joining, setJoining] = useState(false);

    const [createdCode, setCreatedCode] = useState("");
    const [copied, setCopied] = useState(false);

    const { addToUserHistory, handleLogout } = useContext(AuthContext);

    const createdLink = createdCode ? `${window.location.origin}/${createdCode}` : "";

    const enterRoom = async (code) => {
        setJoining(true);
        try {
            await addToUserHistory(code);
        } catch (e) {
            // Failing to record history shouldn't stop someone joining a call.
            console.error("Could not save to history", e);
        } finally {
            setJoining(false);
            navigate(`/${code}`);
        }
    };

    const handleCreate = () => {
        setCreatedCode(newMeetingCode());
        setCopied(false);
        setError("");
    };

    const handleCopy = async () => {
        try {
            await navigator.clipboard.writeText(createdLink);
            setCopied(true);
        } catch (e) {
            // The Clipboard API needs a secure context, so it fails on plain
            // http. Select the text instead and let them copy by hand.
            linkRef.current?.select();
        }
    };

    const handleJoin = () => {
        const code = meetingCode.trim();

        // Matches the backend's validation in addToHistory
        if (!/^[a-zA-Z0-9_-]{4,64}$/.test(code)) {
            setError("Use 4-64 letters, numbers, dashes or underscores.");
            return;
        }

        enterRoom(code);
    };

    return (
        <div className="mmShell">
            <div className="mmAperture" aria-hidden="true" />

            <nav className="mmNav">
                <span className="mmMark">
                    <img src="/MMLogo.png" alt="" />
                    <em>Meet</em>Mingle
                </span>

                <div className="mmNavLinks">
                    <button type="button" className="mmLink" onClick={() => navigate("/history")}>
                        History
                    </button>
                    <button type="button" className="mmLink" onClick={handleLogout}>
                        Log out
                    </button>
                </div>
            </nav>

            <main className="mmHome">
                <div>
                    <h1 className="mmHomeTitle">Start or join a meeting</h1>
                    <p className="mmHomeLead">
                        Create a room and share the link, or enter a code someone sent you.
                    </p>

                    <div className="mmChoice">
                        <section className="mmChoiceCard">
                            <h2 className="mmChoiceTitle">New meeting</h2>
                            <p className="mmChoiceLead">
                                We'll generate a code and a link you can send anyone.
                            </p>
                            <button type="button" className="mmBtn" onClick={handleCreate}>
                                Create a meeting
                            </button>
                        </section>

                        <section className="mmChoiceCard">
                            <h2 className="mmChoiceTitle">Join a meeting</h2>
                            <p className="mmChoiceLead">Enter the code you were given.</p>

                            <div className="mmJoin">
                                <input
                                    className="mmField"
                                    value={meetingCode}
                                    onChange={(e) => {
                                        setMeetingCode(e.target.value);
                                        setError("");
                                    }}
                                    onKeyDown={(e) => e.key === "Enter" && handleJoin()}
                                    placeholder="abc-defg-hij"
                                    aria-label="Meeting code"
                                    aria-invalid={Boolean(error)}
                                />
                                <button
                                    type="button"
                                    className="mmBtn mmBtnGhost"
                                    onClick={handleJoin}
                                    disabled={joining}
                                >
                                    Join
                                </button>
                            </div>

                            {error && <p className="mmError">{error}</p>}
                        </section>
                    </div>

                    {createdCode && (
                        <div className="mmCreated">
                            <p className="mmLabel">Your meeting is ready</p>

                            <div className="mmJoin">
                                <input
                                    ref={linkRef}
                                    className="mmField mmLinkField"
                                    value={createdLink}
                                    readOnly
                                    aria-label="Meeting link"
                                    onFocus={(e) => e.target.select()}
                                />
                                <button type="button" className="mmBtn mmBtnGhost" onClick={handleCopy}>
                                    {copied ? "Copied" : "Copy link"}
                                </button>
                            </div>

                            <p className="mmHint">
                                Anyone with this link can join, so only send it to people you want
                                in the room.
                            </p>

                            <button
                                type="button"
                                className="mmBtn"
                                disabled={joining}
                                onClick={() => enterRoom(createdCode)}
                            >
                                {joining ? "Starting…" : "Start now"}
                            </button>
                        </div>
                    )}
                </div>

                <div className="mmHomeArt">
                    <img src="/logo3.png" alt="" />
                </div>
            </main>
        </div>
    );
}

export default withAuth(HomeComponent);