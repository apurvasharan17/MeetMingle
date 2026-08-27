import React, { useContext, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button, IconButton, TextField } from "@mui/material";
import RestoreIcon from "@mui/icons-material/Restore";

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
            setError("Meeting code must be 4-64 letters, numbers, - or _");
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
        <>
            <div className="navBar">
                <div style={{ display: "flex", alignItems: "center" }}>
                    <h2>MeetMingle Video Call</h2>
                </div>

                <div style={{ display: "flex", alignItems: "center" }}>
                    <IconButton onClick={() => navigate("/history")} aria-label="History">
                        <RestoreIcon />
                    </IconButton>
                    <p>History</p>

                    <Button onClick={handleLogout}>Logout</Button>
                </div>
            </div>

            <div className="meetContainer">
                <div className="leftPanel">
                    <div>
                        <h2>Start or join a meeting</h2>

                        <div style={{ display: "flex", gap: "10px" }}>
                            <TextField
                                value={meetingCode}
                                onChange={(e) => {
                                    setMeetingCode(e.target.value);
                                    setError("");
                                }}
                                onKeyDown={(e) => e.key === "Enter" && handleJoinVideoCall()}
                                label="Meeting Code"
                                variant="outlined"
                                error={Boolean(error)}
                                helperText={error}
                            />
                            <Button onClick={handleJoinVideoCall} variant="contained" disabled={joining}>
                                Join
                            </Button>
                        </div>
                    </div>
                </div>

                <div className="rightPanel">
                    <img src="/logo3.png" alt="" />
                </div>
            </div>
        </>
    );
}

export default withAuth(HomeComponent);