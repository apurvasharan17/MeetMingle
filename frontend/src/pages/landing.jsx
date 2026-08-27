import React from "react";
import { Link, useNavigate } from "react-router-dom";
import "../App.css";

// Guests get a fresh random room instead of everyone landing in the same
// hardcoded one.
const randomRoomCode = () => Math.random().toString(36).slice(2, 10);

export default function LandingPage() {
    const navigate = useNavigate();

    return (
        <div className="landingPageContainer">
            <nav>
                <div className="navHeader">
                    <h2>
                        {/* Absolute path, so it resolves the same on nested routes. */}
                        <img src="/MMLogo.png" alt="" style={{ height: "25px", width: "25px" }} />
                        <span style={{ color: "orange" }}>Meet</span>Mingle
                    </h2>
                </div>

                <div className="navlist">
                    <p role="button" onClick={() => navigate(`/${randomRoomCode()}`)}>
                        Join as Guest
                    </p>
                    <p role="button" onClick={() => navigate("/auth")}>
                        Register
                    </p>
                    <div role="button" onClick={() => navigate("/auth")}>
                        <p>Login</p>
                    </div>
                </div>
            </nav>

            <div className="landingMainContainer">
                <div className="description">
                    <h1>
                        <span style={{ color: "#FF9839" }}>Connect</span> with your loved ones
                    </h1>

                    <p>Cover the distance with a MeetMingle video call</p>

                    <div role="button">
                        <Link to="/auth">Get Started</Link>
                    </div>
                </div>

                <div>
                    <img src="/mobile.png" alt="" />
                </div>
            </div>
        </div>
    );
}