import express from 'express';
import { healthRouter } from './routes/health.js';

export function createApp(config) {
    const app = express();

    app.set('env', config.nodeEnv);
    app.disable('x-powered-by');

    app.set('trust proxy', 'loopback');

    app.use(healthRouter());

    app.use((_req, res) => {
        res.status(404).json({ erro: 'Não encontrado'});
    });

    app.use((err, _req, res, _next) => {
        console.error(err);
        res.status(500).json({ erro: 'Erro interno'});
    });

    return app;
}