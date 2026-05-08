import db from './db';

function generateCode() {
    return String(Math.floor(100000 + Math.random() * 900000));
}

async function saveOtp(username, code) {
    const expiryMinutes = Number(process.env.OTP_EXPIRY_MINUTES) || 10;
    await db.query('DELETE FROM otp_sessions WHERE username = ? OR expires_at < NOW()', [username]);
    await db.query(
        'INSERT INTO otp_sessions (username, otp_code, expires_at) VALUES (?, ?, DATE_ADD(NOW(), INTERVAL ? MINUTE))',
        [username, code, expiryMinutes]
    );
}

async function validateOtp(username, code) {
    const [rows] = await db.query(
        'SELECT id FROM otp_sessions WHERE username = ? AND otp_code = ? AND usado = FALSE AND expires_at > NOW()',
        [username, code]
    );
    if (rows.length === 0) return false;
    await db.query('UPDATE otp_sessions SET usado = TRUE WHERE id = ?', [rows[0].id]);
    return true;
}

async function sendOtpEmail(username, code) {
    const stefanUrl = process.env.STEFAN_URL;
    const clientKey = process.env.STEFAN_CLIENT_KEY;
    if (!stefanUrl || !clientKey) {
        throw new Error("STEFAN_URL ou STEFAN_CLIENT_KEY não configurados no .env.local.");
    }
    const expiryMinutes = Number(process.env.OTP_EXPIRY_MINUTES) || 10;

    const body = {
        idSistema: 2,
        clientKey: clientKey,
        emailDestinatario: [username],
        tituloMensagem: 'Código de acesso - Gestão de RPNP',
        corpoMensagem: `
        <hr>
        <h1>Sistema de Gestão e Monitoramento de Restos a Pagar - SCCG</h1>
        <p>Seu código de acesso é: <b>${code}</b><p>
        Este código expira em ${expiryMinutes} minutos.<br>
        Se não foi você quem solicitou, ignore este e-mail.`,
        cdTemplateMsg: 1,
        qtdeDiasAntesExpurgo: 1,
    };
    
    const response = await fetch(`${stefanUrl}/enviar-email`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
    });

    if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.message || `STEFAN email error ${response.status}`);
    }
}

export async function dispatchOtp(username) {
    const code = generateCode();
    await saveOtp(username, code);
    await sendOtpEmail(username, code);
}

export { validateOtp };
