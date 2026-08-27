import React, { useContext, useState } from "react";
import { useNavigate } from "react-router-dom";

import { AuthContext } from "../contexts/AuthContext";
import "../App.css";

export default function Authentication() {
    // Initialised to "" rather than undefined, so the inputs are controlled
    // from the first render (React warns when they switch part-way).
    const [username, setUsername] = useState("");
    const [password, setPassword] = useState("");
    const [name, setName] = useState("");
    const [error, setError] = useState("");
    const [notice, setNotice] = useState("");
    const [submitting, setSubmitting] = useState(false);
    const [isSignUp, setIsSignUp] = useState(false);

    const navigate = useNavigate();
    const { handleRegister, handleLogin } = useContext(AuthContext);

    const switchMode = (signUp) => {
        setIsSignUp(signUp);
        setError("");
        setNotice("");
    };

    const handleAuth = async () => {
        setError("");
        setNotice("");
        setSubmitting(true);

        try {
            if (isSignUp) {
                await handleRegister(name, username, password);
                setNotice("Account created. Sign in to continue.");
                setName("");
                setPassword("");
                setIsSignUp(false);
            } else {
                await handleLogin(username, password);
            }
        } catch (err) {
            // err.response is undefined on a network failure, which used to
            // throw a second error inside the catch block.
            setError(
                err?.response?.data?.message ||
                    "Can't reach the server. Check your connection and try again."
            );
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <div className="mmAuth">
            <aside
                className="mmAuthAside"
                style={{
                    backgroundImage:
                        `linear-gradient(160deg, rgba(6,9,31,0.55), rgba(6,9,31,0.95)), url(${process.env.PUBLIC_URL}/background.png)`,
                    backgroundSize: "cover",
                    backgroundPosition: "center",
                }}
            >
                <span className="mmMark" role="button" onClick={() => navigate("/")}>
                    <img src="/MMLogo.png" alt="" />
                    <em>Meet</em>Mingle
                </span>

                <p className="mmAuthQuote">
                    Cover the distance with a <em>single link</em>.
                </p>

                <p className="mmAuthMeta">Rooms open the moment you join. No download, no waiting.</p>
            </aside>

            <div className="mmAuthPanel">
                <div className="mmAuthCard">
                    <h1 className="mmAuthTitle">{isSignUp ? "Create an account" : "Welcome back"}</h1>
                    <p className="mmAuthLead">
                        {isSignUp
                            ? "You'll need one to keep your meeting history."
                            : "Sign in to start or join a meeting."}
                    </p>

                    <div className="mmSwitch" role="tablist">
                        <button
                            type="button"
                            role="tab"
                            aria-selected={!isSignUp}
                            onClick={() => switchMode(false)}
                        >
                            Sign in
                        </button>
                        <button
                            type="button"
                            role="tab"
                            aria-selected={isSignUp}
                            onClick={() => switchMode(true)}
                        >
                            Sign up
                        </button>
                    </div>

                    <div className="mmStack">
                        {isSignUp && (
                            <div>
                                <label className="mmLabel" htmlFor="name">
                                    Full name
                                </label>
                                <input
                                    className="mmField"
                                    id="name"
                                    name="name"
                                    value={name}
                                    autoComplete="name"
                                    onChange={(e) => setName(e.target.value)}
                                />
                            </div>
                        )}

                        <div>
                            <label className="mmLabel" htmlFor="username">
                                Username
                            </label>
                            <input
                                className="mmField"
                                id="username"
                                name="username"
                                value={username}
                                autoComplete="username"
                                onChange={(e) => setUsername(e.target.value)}
                            />
                        </div>

                        <div>
                            <label className="mmLabel" htmlFor="password">
                                Password
                            </label>
                            <input
                                className="mmField"
                                id="password"
                                name="password"
                                type="password"
                                value={password}
                                autoComplete={isSignUp ? "new-password" : "current-password"}
                                onChange={(e) => setPassword(e.target.value)}
                                onKeyDown={(e) => e.key === "Enter" && handleAuth()}
                            />
                            {isSignUp && <p className="mmHint">At least 8 characters.</p>}
                        </div>

                        {error && <p className="mmError">{error}</p>}
                        {notice && <p className="mmHint">{notice}</p>}

                        <button
                            type="button"
                            className="mmBtn"
                            disabled={submitting}
                            onClick={handleAuth}
                        >
                            {submitting ? "Working…" : isSignUp ? "Create account" : "Sign in"}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}