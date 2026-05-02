import { Router } from "express";
import uploadRouter from "./upload";
import analyzeRouter from "./analyze";
import matchJobRouter from "./matchJob";
import improveRouter from "./improve";
import reportRouter from "./report";
import roleAnalyzeRouter from "./roleAnalyze";
import recruiterSimRouter from "./recruiterSim";
import benchmarkRouter from "./benchmark";
import improveBulletsRouter from "./improveBullets";
import actionPlanRouter from "./actionPlan";
import redFlagsRouter from "./redFlags";
import paddingDetectorRouter from "./paddingDetector";
import careerTrajectoryRouter from "./careerTrajectory";

const router = Router();

router.use("/resume", uploadRouter);
router.use("/resume", analyzeRouter);
router.use("/resume", matchJobRouter);
router.use("/resume", improveRouter);
router.use("/resume", reportRouter);
router.use("/resume", roleAnalyzeRouter);
router.use("/resume", recruiterSimRouter);
router.use("/resume", benchmarkRouter);
router.use("/resume", improveBulletsRouter);
router.use("/resume", actionPlanRouter);
router.use("/resume", redFlagsRouter);
router.use("/resume", paddingDetectorRouter);
router.use("/resume", careerTrajectoryRouter);

export default router;
