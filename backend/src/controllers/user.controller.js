import httpStatus from "http-status";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";

import { User } from "../models/user.model.js";
import { Meeting } from "../models/meeting.model.js";

const TOKEN_TTL = process.env.JWT_EXPIRES_IN || "7d";

const signToken = (user) =>
  jwt.sign({ sub: user._id.toString(), username: user.username }, process.env.JWT_SECRET, {
    expiresIn: TOKEN_TTL,
  });

const login = async (req, res, next) => {
  const { username, password } = req.body || {};

  if (!username || !password) {
    return res
      .status(httpStatus.BAD_REQUEST)
      .json({ message: "Username and password are required" });
  }

  try {
    const user = await User.findOne({ username: username.trim().toLowerCase() }).select(
      "+password"
    );

    // Identical response for "no such user" and "wrong password", so this
    // endpoint can't be used to enumerate valid usernames
    if (!user || !(await bcrypt.compare(password, user.password))) {
      return res
        .status(httpStatus.UNAUTHORIZED)
        .json({ message: "Invalid username or password" });
    }

    return res.status(httpStatus.OK).json({
      token: signToken(user),
      user: { name: user.name, username: user.username },
    });
  } catch (e) {
    return next(e);
  }
};

const register = async (req, res, next) => {
  const { name, username, password } = req.body || {};

  if (!name || !username || !password) {
    return res
      .status(httpStatus.BAD_REQUEST)
      .json({ message: "Name, username and password are required" });
  }

  if (password.length < 8) {
    return res
      .status(httpStatus.BAD_REQUEST)
      .json({ message: "Password must be at least 8 characters" });
  }

  const normalized = username.trim().toLowerCase();

  try {
    const existingUser = await User.findOne({ username: normalized });
    if (existingUser) {
      return res.status(httpStatus.CONFLICT).json({ message: "Username already taken" });
    }

    const hashedPassword = await bcrypt.hash(password, 12);

    await User.create({ name: name.trim(), username: normalized, password: hashedPassword });

    return res.status(httpStatus.CREATED).json({ message: "Registration successful" });
  } catch (e) {
    // Covers the race between findOne and create (unique index on username)
    if (e.code === 11000) {
      return res.status(httpStatus.CONFLICT).json({ message: "Username already taken" });
    }
    return next(e);
  }
};

const getUserHistory = async (req, res, next) => {
  try {
    const meetings = await Meeting.find({ user_id: req.user.username })
      .sort({ date: -1 })
      .limit(100)
      .lean();

    return res.json(meetings);
  } catch (e) {
    return next(e);
  }
};

const addToHistory = async (req, res, next) => {
  const { meeting_code: meetingCode } = req.body || {};

  if (!meetingCode || !/^[a-zA-Z0-9_-]{4,64}$/.test(meetingCode)) {
    return res.status(httpStatus.BAD_REQUEST).json({ message: "Invalid meeting code" });
  }

  try {
    await Meeting.create({ user_id: req.user.username, meetingCode });
    return res.status(httpStatus.CREATED).json({ message: "Added code to history" });
  } catch (e) {
    return next(e);
  }
};

export { login, register, getUserHistory, addToHistory };