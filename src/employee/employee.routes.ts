import { Router } from "express";
import { employeeRepository } from "./employee.repository.js";
import { EmployeeService } from "./employee.service.js";
import { EmployeeController } from "./employee.controller.js";
import { authMiddleware } from "../middlewares/auth.middleware.js";

// Instanciation des couches (Pattern 3-tiers avec Injection du Repository)
const employeeService = new EmployeeService(employeeRepository);
const employeeController = new EmployeeController(employeeService);

const employeeRouter = Router();

// Toutes les routes /employees sont protégées
employeeRouter.use(authMiddleware);

employeeRouter.get("/", employeeController.getAll);
employeeRouter.get("/:id", employeeController.getById);
employeeRouter.post("/", employeeController.create);
employeeRouter.put("/:id", employeeController.update);
employeeRouter.delete("/:id", employeeController.delete);

export { employeeRouter, employeeRouter as routeur };
export default employeeRouter;
