# Testes Pendentes — SuperRH

> Vitest ainda não configurado no projeto. Cenários a cobrir na próxima sprint.

## api/users

### test_create_user_sucesso_com_dados_validos
- POST /api/users com name, email, password, role válidos
- Esperado: 201 + usuário criado sem password_hash na resposta

### test_create_user_falha_com_email_duplicado
- POST /api/users com email já existente
- Esperado: 409 + mensagem de conflito

### test_create_user_falha_com_senha_curta
- POST /api/users com password de 3 chars
- Esperado: 400

### test_create_user_falha_com_role_invalido
- POST /api/users com role: "hacker"
- Esperado: 400

### test_update_user_falha_com_nome_vazio
- PUT /api/users/:id com name: "   "
- Esperado: 400

### test_delete_user_falha_auto_exclusao
- DELETE /api/users com id igual ao próprio sub do JWT
- Esperado: 400

### test_acesso_negado_sem_super_admin
- GET /api/users com role: "rh"
- Esperado: 403

## api/notices

### test_pin_falha_sem_boolean
- PATCH /api/notices/:id com body vazio
- Esperado: 400

### test_create_notice_sucesso
- POST /api/notices com title e body
- Esperado: 201

### test_create_notice_falha_sem_permissao
- POST /api/notices com role: "colaborador"
- Esperado: 403

## api/absences

### test_create_absence_falha_employee_outra_empresa
- POST /api/absences com employee_id de outra company
- Esperado: 404

### test_create_absence_falha_type_invalido
- POST /api/absences com type: "sabado"
- Esperado: 400
