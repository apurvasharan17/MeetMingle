import httpStatus from "http-status";
import jwt from "jsonwebtoken";

/**
 * Reads the bearer token from the Authorization header and attaches the
 * decoded payload to req.user. Headers rather than query strings, so tokens
 * don't land in access logs or browser history.
 */
export const requireAuth = (req, res, next) => {
  const header = req.headers.authorization || "";
  const [scheme, token] = header.split(" ");

  if (scheme !== "Bearer" || !token) {
    return res.status(httpStatus.UNAUTHORIZED).json({ message: "Authentication required" });
  }

  try {
    req.user = jwt.verify(token, process.env.JWT_SECRET);
    return next();
  } catch (e) {
    return res
      .status(httpStatus.UNAUTHORIZED)
      .json({ message: "Session expired, please log in again" });
  }
};