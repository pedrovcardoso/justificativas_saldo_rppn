import db from '@/lib/db';
import { requireAuth } from '@/lib/auth';
import { ok, authError, badRequest, conflict, serverError } from '@/lib/response';

export async function POST(request) {
    try {
        const auth = await requireAuth(request);
        if (auth.error) return authError(auth);

        const { acao, justificativa, dados } = auth.body;

        if (!acao || justificativa === undefined || justificativa === null || !Array.isArray(dados) || dados.length === 0) {
            return badRequest('Campos "acao", "justificativa" e "dados" são obrigatórios.');
        }

        const results = [];

        for (const item of dados) {
            const { rppn } = item;

            const isAdmin = auth.role === 'admin';

            const [dataCheck] = await db.query(
                `SELECT uo_codigo FROM restos_a_pagar WHERE rppn = ?`,
                [rppn]
            );

            if (dataCheck.length === 0) {
                results.push({
                    success: false,
                    statusCode: '404',
                    error: 'Registro não encontrado.',
                    data: { rppn },
                });
                continue;
            }

            if (!isAdmin && dataCheck[0].uo_codigo !== auth.uo) {
                results.push({
                    success: false,
                    statusCode: '403',
                    error: 'Acesso negado a esta UO.',
                    data: { rppn },
                });
                continue;
            }

            const [existing] = await db.query(
                `SELECT id FROM justificativas WHERE rppn = ? AND status = 'Pendente'`,
                [rppn]
            );

            if (existing.length > 0) {
                results.push({
                    success: false,
                    statusCode: '409',
                    error: 'Outra justificativa em aberto.',
                    data: { rppn },
                });
                continue;
            }

            const [result] = await db.query(
                `INSERT INTO justificativas (rppn, user_justificativa, acao, justificativa)
         VALUES (?, ?, ?, ?)`,
                [rppn, auth.user, acao, justificativa]
            );

            results.push({
                success: true,
                statusCode: '200',
                message: 'Dados salvos com sucesso.',
                data: { id: String(result.insertId), rppn },
            });
        }

        return ok(results, 'Operação concluída.');
    } catch (e) {
        return serverError(e.message);
    }
}
