import axios from "axios";
import httpStatus from "http-status";
import { createContext, useCallback, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import server from "../environment";

export const AuthContext = createContext({});

const client = axios.create({
    baseURL: `${server}/api/v1/users`,
});

// Attach the bearer token to every request instead of passing it as a query
// param or body field
client.interceptors.request.use((config) => {
    const token = localStorage.getItem("token");
    if (token) config.headers.Authorization = `Bearer ${token}`;
    return config;
});

export const AuthProvider = ({ children }) => {
    const [userData, setUserData] = useState(null);
    const navigate = useNavigate();

    const handleRegister = useCallback(async (name, username, password) => {
        const request = await client.post("/register", { name, username, password });
        return request.data?.message;
    }, []);

    const handleLogin = useCallback(async (username, password) => {
        const request = await client.post("/login", { username, password });

        if (request.status === httpStatus.OK) {
            localStorage.setItem("token", request.data.token);
            setUserData(request.data.user ?? null);
            navigate("/home");
        }
    }, [navigate]);

    const handleLogout = useCallback(() => {
        localStorage.removeItem("token");
        setUserData(null);
        navigate("/auth");
    }, [navigate]);

    const getHistoryOfUser = useCallback(async () => {
        const request = await client.get("/get_all_activity");
        return request.data;
    }, []);

    const addToUserHistory = useCallback(async (meetingCode) => {
        return client.post("/add_to_activity", { meeting_code: meetingCode });
    }, []);

    const data = useMemo(
        () => ({
            userData,
            setUserData,
            addToUserHistory,
            getHistoryOfUser,
            handleRegister,
            handleLogin,
            handleLogout,
        }),
        [userData, addToUserHistory, getHistoryOfUser, handleRegister, handleLogin, handleLogout]
    );

    return <AuthContext.Provider value={data}>{children}</AuthContext.Provider>;
};