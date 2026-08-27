import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

/**
 * Redirects to /auth when there is no token. The original rendered the wrapped
 * component immediately, so protected pages flashed their contents (and fired
 * their data requests) before the redirect landed.
 */
const withAuth = (WrappedComponent) => {
    const AuthComponent = (props) => {
        const navigate = useNavigate();
        const [checked, setChecked] = useState(false);

        useEffect(() => {
            if (!localStorage.getItem("token")) {
                navigate("/auth", { replace: true });
            } else {
                setChecked(true);
            }
        }, [navigate]);

        if (!checked) return null;

        return <WrappedComponent {...props} />;
    };

    AuthComponent.displayName = `withAuth(${
        WrappedComponent.displayName || WrappedComponent.name || "Component"
    })`;

    return AuthComponent;
};

export default withAuth;