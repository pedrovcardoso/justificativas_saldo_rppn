import db from '@/lib/db';
import { requireAdmin } from '@/lib/auth';
import { ok, authError, badRequest, serverError } from '@/lib/response';

export async function POST(request) {
    try {
        const admin = await requireAdmin(request);
        if (admin.error) return authError(admin);

        const formData = await admin.body;
        const file = formData.get('file');

        if (!file) {
            return badRequest('Nenhum arquivo enviado.');
        }

        const bytes = await file.arrayBuffer();
        const content = new TextDecoder('utf-8').decode(bytes);

        const lines = content.split(/\r?\n/).filter(line => line.trim() !== '');

        if (lines.length < 2) {
            return badRequest('O arquivo CSV está vazio ou contém apenas o cabeçalho.');
        }

        const dataRows = lines.slice(1);

        const connection = await db.getConnection();
        try {
            await connection.beginTransaction();
            await connection.query('TRUNCATE TABLE restos_a_pagar');

            const insertQuery = `
        INSERT INTO restos_a_pagar (
          uo_codigo, ue_codigo, ano_origem, documento, funcao, subfuncao,
          programa, projeto_atividade, subprojeto, natureza_item, elemento_item,
          fonte_recurso, procedencia, saldo_rppn, valor_inscrito, valor_pago, valor_cancelado
        ) VALUES ?
      `;

            const values = dataRows.map(line => {
                const parts = line.match(/"([^"]*)"/g)?.map(p => p.slice(1, -1)) || [];

                const parseCurrency = (val) => {
                    if (!val) return 0;
                    return parseFloat(val.replace(/\./g, '').replace(',', '.'));
                };

                return [
                    parts[0] || null,
                    parts[1] || null,
                    parts[2] || null,
                    parts[3] || null,
                    parts[4] || null,
                    parts[5] || null,
                    parts[6] || null,
                    parts[7] || null,
                    parts[8] || null,
                    parts[9] || null,
                    parts[10] || null,
                    parts[11] || null,
                    parts[12] || null,
                    parseCurrency(parts[13]),
                    parseCurrency(parts[14]),
                    parseCurrency(parts[15]),
                    parseCurrency(parts[16])
                ];
            });

            if (values.length > 0) {
                await connection.query(insertQuery, [values]);
            }

            await connection.commit();

            return ok({ count: values.length }, 'Importação concluída com sucesso.');
        } catch (err) {
            await connection.rollback();
            throw err;
        } finally {
            connection.release();
        }
    } catch (e) {
        return serverError(e.message);
    }
}
