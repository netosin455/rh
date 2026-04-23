import express, { Request, Response } from 'express';

import authLogin        from '../api/auth/login';
import employees        from '../api/employees/index';
import employeeById     from '../api/employees/[id]';
import absences         from '../api/absences/index';
import absenceById      from '../api/absences/[id]';
import absenceApprove   from '../api/absences/[id]/approve';
import cases            from '../api/cases/index';
import caseById         from '../api/cases/[id]';
import events           from '../api/events/index';
import eventById        from '../api/events/[id]';
import chat             from '../api/chat';

const app = express();
app.use(express.json());

app.all('/api/auth/login', authLogin as any);
app.all('/api/employees', employees as any);

app.all('/api/employees/:id', (req: Request, res: Response) => {
  req.query.id = req.params.id;
  return (employeeById as any)(req, res);
});

app.all('/api/absences', absences as any);

app.all('/api/absences/:id/approve', (req: Request, res: Response) => {
  req.query.id = req.params.id;
  return (absenceApprove as any)(req, res);
});

app.all('/api/absences/:id', (req: Request, res: Response) => {
  req.query.id = req.params.id;
  return (absenceById as any)(req, res);
});

app.all('/api/cases', cases as any);

app.all('/api/cases/:id', (req: Request, res: Response) => {
  req.query.id = req.params.id;
  return (caseById as any)(req, res);
});

app.all('/api/events', events as any);

app.all('/api/events/:id', (req: Request, res: Response) => {
  req.query.id = req.params.id;
  return (eventById as any)(req, res);
});

app.all('/api/chat', chat as any);

export default app;
