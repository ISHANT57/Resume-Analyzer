import { Router, type IRouter } from "express";
import healthRouter from "./health";
import resumeRouter from "./resume/index";
import historyRouter from "./resume/history";

const router: IRouter = Router();

router.use(healthRouter);
router.use(resumeRouter);
router.use(historyRouter);

export default router;
