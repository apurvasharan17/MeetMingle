import React, { useContext, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Typography from "@mui/material/Typography";
import HomeIcon from "@mui/icons-material/Home";
import { IconButton } from "@mui/material";

import withAuth from "../utils/withAuth";
import { AuthContext } from "../contexts/AuthContext";

function History() {
    const { getHistoryOfUser } = useContext(AuthContext);
    const navigate = useNavigate();

    const [meetings, setMeetings] = useState([]);
    const [status, setStatus] = useState("loading");

    useEffect(() => {
        let active = true;

        const fetchHistory = async () => {
            try {
                const history = await getHistoryOfUser();
                if (!active) return;
                setMeetings(Array.isArray(history) ? history : []);
                setStatus("done");
            } catch (e) {
                if (active) setStatus("error");
            }
        };

        fetchHistory();
        return () => {
            active = false;
        };
    }, [getHistoryOfUser]);

    const formatDate = (dateString) => {
        const date = new Date(dateString);
        if (Number.isNaN(date.getTime())) return "Unknown date";

        const day = date.getDate().toString().padStart(2, "0");
        const month = (date.getMonth() + 1).toString().padStart(2, "0");
        return `${day}/${month}/${date.getFullYear()}`;
    };

    return (
        <div style={{ padding: 16 }}>
            <IconButton onClick={() => navigate("/home")} aria-label="Home">
                <HomeIcon />
            </IconButton>

            {status === "loading" && <p>Loading your meetings…</p>}
            {status === "error" && <p>Could not load your history. Please try again.</p>}
            {status === "done" && meetings.length === 0 && <p>No meetings yet.</p>}

            {meetings.map((meeting) => (
                // key belongs on the outermost element of the map, and the
                // database id is stable where the array index is not.
                <Card key={meeting._id} variant="outlined" sx={{ mb: 1.5 }}>
                    <CardContent>
                        <Typography sx={{ fontSize: 14 }} color="text.secondary" gutterBottom>
                            Code: {meeting.meetingCode}
                        </Typography>
                        <Typography sx={{ mb: 1.5 }} color="text.secondary">
                            Date: {formatDate(meeting.date)}
                        </Typography>
                    </CardContent>
                </Card>
            ))}
        </div>
    );
}

export default withAuth(History);