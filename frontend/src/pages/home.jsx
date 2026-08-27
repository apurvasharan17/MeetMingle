import React, { useContext, useState } from "react";
import { useNavigate } from "react-router-dom";

import withAuth from "../utils/withAuth";
import { AuthContext } from "../contexts/AuthContext";
import "../App.css";

function HomeComponent() {
    const navigate = useNavigate();
    const [meetingCode, setMeetingCode] = useState("");
    const [error, setError] = useState("");
    const [joining, setJoining] = useState(false);

    const { addToUserHistory, handleLogout } = useContext(AuthContext);

    const handleJoinVideoCall = async () => {
        const code = meetingCode.trim();

        // Matches the backend's validation in addToHistory
        if (!/^[a-zA-Z0-9_-]{4,64}$/.test(code)) {
            setError("Use 4-64 letters, numbers, dashes or underscores.");
            return;
        }

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
                        Enter a code you've been given, or make one up — whoever uses the same
                        code lands in the same room.
                    </p>

                    <div className="mmJoin">
                        <input
                            className="mmField"
                            value={meetingCode}
                            onChange={(e) => {
                                setMeetingCode(e.target.value);
                                setError("");
                            }}
                            onKeyDown={(e) => e.key === "Enter" && handleJoinVideoCall()}
                            placeholder="Meeting code"
                            aria-label="Meeting code"
                            aria-invalid={Boolean(error)}
                        />
                        <button
                            type="button"
                            className="mmBtn"
                            onClick={handleJoinVideoCall}
                            disabled={joining}
                        >
                            {joining ? "Joining…" : "Join"}
                        </button>
                    </div>

                    {error && <p className="mmError">{error}</p>}
                </div>

                <div className="mmHomeArt">
                    <img src="/logo3.png" alt="" />
                </div>
            </main>
        </div>
    );
}

export default withAuth(HomeComponent);