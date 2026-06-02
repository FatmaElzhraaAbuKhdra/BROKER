import { Router, type IRouter } from "express";
import healthRouter from "./health";
import authRouter from "./auth";
import unitTypesRouter from "./unit-types";
import projectsRouter from "./projects";
import buildingsRouter from "./buildings";
import floorsRouter from "./floors";
import customersRouter from "./customers";
import unitsRouter from "./units";
import salesRouter from "./sales";
import dashboardRouter from "./dashboard";
import usersRouter from "./users";

const router: IRouter = Router();

router.use(healthRouter);
router.use(authRouter);
router.use(unitTypesRouter);
router.use(projectsRouter);
router.use(buildingsRouter);
router.use(floorsRouter);
router.use(customersRouter);
router.use(unitsRouter);
router.use(salesRouter);
router.use(dashboardRouter);
router.use(usersRouter);

export default router;
