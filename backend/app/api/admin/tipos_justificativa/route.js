import db from '@/lib/db';
import { requireAuth } from '@/lib/auth';
import { ok, authError, badRequest, forbidden, serverError } from '@/lib/response';

export async function GET(request) {
    try {
        const auth = await requireAuth(request);
        if (auth.error) return authError(auth);

        const [rows] = await db.query(
            'SELECT id, nome, campos, ativo FROM tipos_justificativa ORDER BY nome ASC'
        );

        const parsed = rows.map(r => ({
            ...r,
            campos: typeof r.campos === 'string' ? JSON.parse(r.campos) : r.campos,
            ativo: Boolean(r.ativo),
        }));

        return ok(parsed);
    } catch (e) {
        return serverError(e.message);
    }
}

export async function POST(request) {
    try {
        const auth = await requireAuth(request);
        if (auth.error) return authError(auth);
        if (auth.role !== 'admin') return forbidden();

        const { id, nome, campos, ativo } = auth.body;

        if (!nome || !Array.isArray(campos) || campos.length === 0) {
            return badRequest('Campos "nome" e "campos" são obrigatórios.');
        }

        const camposJson = JSON.stringify(campos);
        const ativoVal = ativo !== false ? 1 : 0;

        if (id) {
            await db.query(
                'UPDATE tipos_justificativa SET nome = ?, campos = ?, ativo = ? WHERE id = ?',
                [nome, camposJson, ativoVal, id]
            );
        } else {
            await db.query(
                'INSERT INTO tipos_justificativa (nome, campos, ativo) VALUES (?, ?, ?)',
                [nome, camposJson, ativoVal]
            );
        }

        return ok({}, id ? 'Tipo atualizado com sucesso.' : 'Tipo criado com sucesso.');
    } catch (e) {
        return serverError(e.message);
    }
}
