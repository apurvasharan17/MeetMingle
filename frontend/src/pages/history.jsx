import React, { useContext, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

import withAuth from "../utils/withAuth";
import { AuthContext } from "../contexts/AuthContext";
import "../App.css";

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

        return date.toLocaleDateString(undefined, {
            day: "numeric",
            month: "short",
            year: "numeric",
        });
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
                    <button type="button" className="mmLink" onClick={() => navigate("/home")}>
                        Back to home
                    </button>
                </div>
            </nav>

            <main className="mmHistory">
                <h1 className="mmHistoryTitle">Your meetings</h1>
                <p className="mmHistoryLead">Rooms you've joined, most recent first.</p>

                {status === "loading" && <div className="mmBlank">Loading your meetings…</div>}

                {status === "error" && (
                    <div className="mmBlank">
                        <strong>Couldn't load your history</strong>
                        Reload the page to try again.
                    </div>
                )}

                {status === "done" && meetings.length === 0 && (
                    <div className="mmBlank">
                        <strong>No meetings yet</strong>
                        Join a room and it'll show up here.
                    </div>
                )}

                {meetings.map((meeting) => (
                    // key belongs on the outermost element of the map, and the
                    // database id is stable where the array index is not.
                    <div key={meeting._id} className="mmRow">
                        <div>
                            <p className="mmRowCode">{meeting.meetingCode}</p>
                            <p className="mmRowDate">{formatDate(meeting.date)}</p>
                        </div>
                        <button
                            type="button"
                            className="mmBtn mmBtnGhost"
                            onClick={() => navigate(`/${meeting.meetingCode}`)}
                        >
                            Rejoin
                        </button>
                    </div>
                ))}
            </main>
        </div>
    );
}

export default withAuth(History);