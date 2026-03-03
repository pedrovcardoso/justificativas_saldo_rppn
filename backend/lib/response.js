export function ok(data = {}, message = 'OK') {
    return Response.json({ success: true, message, data }, { status: 200 });
}

export function created(data = {}, message = 'Criado com sucesso.') {
    return Response.json({ success: true, message, data }, { status: 201 });
}

export function badRequest(error = 'Requisição inválida.') {
    return Response.json({ success: false, error }, { status: 400 });
}

export function unauthorized(error = 'Não autorizado.') {
    return Response.json({ success: false, error }, { status: 401 });
}

export function forbidden(error = 'Acesso negado.') {
    return Response.json({ success: false, error }, { status: 403 });
}

export function notFound(error = 'Não encontrado.') {
    return Response.json({ success: false, error }, { status: 404 });
}

export function conflict(error = 'Conflito.') {
    return Response.json({ success: false, error }, { status: 409 });
}

export function serverError(error = 'Erro interno do servidor.') {
    return Response.json({ success: false, error }, { status: 500 });
}

export function authError(result) {
    return Response.json({ success: false, error: result.error }, { status: result.status });
}
