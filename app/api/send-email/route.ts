import nodemailer from 'nodemailer';
import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { to, subject, name, balance, income, expense } = body;

    // Configuração do carteiro (Gmail)
    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
      },
    });

    // O Design Premium do E-mail em HTML (Dark Mode, Estilo Camp.OS)
    const htmlTemplate = `
      <!DOCTYPE html>
      <html lang="pt-BR">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Relatório Camp.OS</title>
      </head>
      <body style="margin: 0; padding: 0; background-color: #09090b; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #ffffff;">
        
        <table width="100%" border="0" cellpadding="0" cellspacing="0" style="background-color: #09090b; padding: 40px 20px;">
          <tr>
            <td align="center">
              
              <!-- Container Principal -->
              <table width="100%" max-width="600" border="0" cellpadding="0" cellspacing="0" style="max-width: 600px; background-color: #18181b; border: 1px solid #27272a; border-radius: 24px; overflow: hidden; margin: 0 auto;">
                
                <!-- Cabeçalho -->
                <tr>
                  <td style="padding: 40px 30px 20px 30px; text-align: center; border-bottom: 1px solid #27272a;">
                    <p style="margin: 0; font-size: 12px; font-weight: 800; letter-spacing: 4px; color: #6366f1; text-transform: uppercase;">Camp.OS Ledger</p>
                    <h1 style="margin: 10px 0 0 0; font-size: 28px; font-weight: 900; color: #ffffff; letter-spacing: -1px;">Relatório de Status</h1>
                    <p style="margin: 10px 0 0 0; font-size: 14px; color: #a1a1aa;">Olá, ${name}. Aqui está o seu resumo financeiro atualizado.</p>
                  </td>
                </tr>

                <!-- Cards de Métricas -->
                <tr>
                  <td style="padding: 30px;">
                    
                    <!-- Saldo Real -->
                    <div style="background-color: #09090b; border: 1px solid #27272a; border-radius: 16px; padding: 24px; margin-bottom: 15px; text-align: center;">
                      <p style="margin: 0 0 5px 0; font-size: 11px; font-weight: 800; letter-spacing: 2px; color: #a1a1aa; text-transform: uppercase;">Saldo Real Consolidado</p>
                      <p style="margin: 0; font-size: 36px; font-weight: 900; color: #ffffff; letter-spacing: -2px;">R$ ${balance}</p>
                    </div>

                    <!-- Receitas e Despesas (Grid) -->
                    <table width="100%" border="0" cellpadding="0" cellspacing="0">
                      <tr>
                        <!-- Entradas -->
                        <td width="48%" style="background-color: #064e3b20; border: 1px solid #05966930; border-radius: 16px; padding: 20px; text-align: center;">
                          <p style="margin: 0 0 5px 0; font-size: 10px; font-weight: 800; letter-spacing: 1px; color: #34d399; text-transform: uppercase;">Entradas</p>
                          <p style="margin: 0; font-size: 20px; font-weight: 900; color: #34d399;">R$ ${income}</p>
                        </td>
                        <td width="4%"></td>
                        <!-- Saídas -->
                        <td width="48%" style="background-color: #7f1d1d20; border: 1px solid #e11d4830; border-radius: 16px; padding: 20px; text-align: center;">
                          <p style="margin: 0 0 5px 0; font-size: 10px; font-weight: 800; letter-spacing: 1px; color: #fb7185; text-transform: uppercase;">Saídas</p>
                          <p style="margin: 0; font-size: 20px; font-weight: 900; color: #ffffff;">R$ ${expense}</p>
                        </td>
                      </tr>
                    </table>

                  </td>
                </tr>

                <!-- Alerta/Ação -->
                <tr>
                  <td style="padding: 0 30px 40px 30px;">
                    <div style="background: linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%); border-radius: 16px; padding: 24px; text-align: center;">
                      <h3 style="margin: 0 0 10px 0; font-size: 16px; font-weight: 800; color: #ffffff;">Inteligência Ativa</h3>
                      <p style="margin: 0 0 20px 0; font-size: 13px; color: #e0e7ff; line-height: 1.5;">O seu painel identificou novas movimentações. Aceda ao sistema para garantir que nenhum vencimento fica pendente.</p>
                      <a href="https://campos-ledger.vercel.app/" style="display: inline-block; background-color: #ffffff; color: #4f46e5; font-size: 12px; font-weight: 900; text-decoration: none; padding: 12px 24px; border-radius: 10px; text-transform: uppercase; letter-spacing: 1px;">Abrir Ledger</a>
                    </div>
                  </td>
                </tr>

                <!-- Footer -->
                <tr>
                  <td style="padding: 20px 30px; text-align: center; background-color: #09090b; border-top: 1px solid #27272a;">
                    <p style="margin: 0; font-size: 10px; color: #52525b;">Este é um e-mail automático gerado pelo Camp.OS Ledger.</p>
                    <p style="margin: 5px 0 0 0; font-size: 10px; color: #52525b;">Não responda a este endereço.</p>
                  </td>
                </tr>

              </table>
            </td>
          </tr>
        </table>

      </body>
      </html>
    `;

    // Envio do e-mail
    const info = await transporter.sendMail({
      from: '"Camp.OS Ledger" <camp.os.alertas@gmail.com>',
      to,
      subject,
      html: htmlTemplate,
    });

    return NextResponse.json({ success: true, messageId: info.messageId });
  } catch (error: any) {
    console.error('Erro ao enviar e-mail:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}