import jwt from "jsonwebtoken";
import User from "../models/userModel.js";

export default async function requireRefresh(req, res, next) {
  const token = req.cookies?.refreshToken;
  if (!token) return res.status(401).json({ message: "No refresh-token" });

  try {
    const { id } = jwt.verify(token, process.env.REFRESH_SECRET); // ← אותו סוד
    const user = await User.findById(id).select("-passwordHash");
    if (!user) return res.status(401).json({ message: "User not found" });

    req.user = user;
    next();
  } catch (err) {                                // ← חייב לקבל err
    console.log("❌ verify refresh failed:", err.message);
    res.status(401).json({ message: "Invalid or expired refresh-token" });
  }
}