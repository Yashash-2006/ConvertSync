import { Router, type IRouter } from "express";
import healthRouter from "./health";
import conversionsRouter from "./conversions";
import storageRouter from "./storage";

const router: IRouter = Router();

router.use(healthRouter);
router.use(conversionsRouter);
router.use(storageRouter);

export default router;
