import React from "react";
import { useNavigate } from "react-router-dom";
import "../App.css";

// Guests get a fresh random room instead of everyone landing in the same
// hardcoded one.
const randomRoomCode = () => Math.random().toString(36).slice(2, 10);

export default function LandingPage() {
    const navigate = useNavigate();

    return (
        <div className="mmShell">
            <div className="mmAperture" aria-hidden="true" />

            <nav className="mmNav">
                <span className="mmMark">
                    <img src="/MMLogo.png" alt="" />
                    <em>Meet</em>Mingle
                </span>

                <div className="mmNavLinks">
                    <button
                        type="button"
                        className="mmLink"
                        onClick={() => navigate(`/${randomRoomCode()}`)}
                    >
                        Join as guest
                    </button>
                    <button type="button" className="mmLink" onClick={() => navigate("/auth")}>
                        Sign in
                    </button>
                </div>
            </nav>

            <main className="mmHero">
                <div>
                    <p className="mmEyebrow">Video calls, no download</p>

                    <h1 className="mmHeadline">
                        <em>Connect</em> with your loved ones
                    </h1>

                    <p className="mmSub">
                        Share a link, and everyone lands in the same room. Nothing to install.
                    </p>

                    <div className="mmHeroActions">
                        <button type="button" className="mmBtn" onClick={() => navigate("/auth")}>
                            Get started
                        </button>
                        <button
                            type="button"
                            className="mmBtn mmBtnGhost"
                            onClick={() => navigate(`/${randomRoomCode()}`)}
                        >
                            Start a call now
                        </button>
                    </div>
                </div>

                <div className="mmHeroArt">
                    <img src="/mobile.png" alt="" />
                </div>
            </main>
        </div>
    );
}