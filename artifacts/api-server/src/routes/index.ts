import { Router, type IRouter } from "express";
import healthRouter from "./health";
import conversionsRouter from "./conversions";

const router: IRouter = Router();

router.use(healthRouter);
router.use(conversionsRouter);

export default router;
