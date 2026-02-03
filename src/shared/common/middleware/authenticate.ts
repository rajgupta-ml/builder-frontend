import type { NextFunction, Request, Response } from "express";
import { verify, type JwtPayload } from "jsonwebtoken";
import { SYSTEM_CONFIG } from "../config";

// Augment Express Request type
declare global {
    namespace Express {
        interface Request {
            user?: string;
            email?: string;
        }
    }
}

export const authenticate = (req : Request, res : Response, next : NextFunction) => {
    try {
        const {authorization} = req.headers;
        if (!authorization) {
            return res.status(401).json({message: "Unauthorized"});
        }
        const token = authorization.split(" ")[1];
        if (!token) {
            return res.status(401).json({message: "Unauthorized"});
        }
        const decoded = verify(token, SYSTEM_CONFIG.JWT_SECRET) as JwtPayload;
        req.user = decoded.id;
        req.email = decoded.email;
        next();
    } catch (error) {
        return res.status(401).json({message: "Unauthorized"});
    }    
}
