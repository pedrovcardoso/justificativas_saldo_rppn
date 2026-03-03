import { ok, badRequest, serverError } from '@/lib/response';

const AUTH_FLOW_URL = process.env.AUTH_FLOW_URL;

export async function POST(request) {
    try {
        const body = await request.json();
        const { endpoint, user, otp_code, otp_channel, token } = body;

        if (!endpoint || !user) {
            return badRequest('Campos "endpoint" e "user" são obrigatórios.');
        }

        const response = await fetch(AUTH_FLOW_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ endpoint, user, otp_code, otp_channel, token }),
        });

        const data = await response.json();
        return Response.json(data, { status: response.status });
    } catch (e) {
        return serverError(e.message);
    }
}
