import express from "express";
import { saveDataRecord } from "../controllers/dataController.js";
// שורה זו משתנה
import requireAuth from "../middlewares/requireAuth.js"; // <-- התיקון כאן

const router = express.Router();

router.post("/save", requireAuth, saveDataRecord);

export default router;