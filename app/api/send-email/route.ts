import { NextResponse } from 'next/server';
import nodemailer from 'nodemailer';
import { createClient } from "@supabase/supabase-js";

// Configurações do SMTP (Gmail)
const SMTP_EMAIL = process.env.SMTP_EMAIL || "camp.os.alertas@gmail.com"; // Seu Gmail criado para a App
const SMTP_PASS = process.env.SMTP_PASS || ""; // A App Password gerada no Google

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
const supabase = createClient(supabaseUrl, supabaseAnonKey);

export async function POST(req: Request) {
  try {
    const { to, subject, name, family_id } = await bodyParse(req);

    if (!to || !family_id) {
      return NextResponse.json({ error: 'Faltam dados: e-mail ou family_id' }, { status: 400 });
    }

    // 1. Busca Dados Reais do Mês Atual no Supabase
    const dateObj = new Date();
    const startOfMonth = new Date(dateObj.getFullYear(), dateObj.getMonth(), 1).toISOString();
    const endOfMonth = new Date(dateObj.getFullYear(), dateObj.getMonth() + 1, 0, 23, 59, 59).toISOString();

    const [txRes, catRes, cardRes] = await Promise.all([
      supabase.from('transactions').select('*').eq('family_id', family_id).gte('date', startOfMonth).lte('date', endOfMonth),
      supabase.from('categories').select('id, name, type'),
      supabase.from('credit_cards').select('id, name')
    ]);

    const transactions = txRes.data || [];
    const categories = catRes.data || [];
    const cards = cardRes.data || [];

    // 2. Processa os Dados Financeiros
    let totalIncome = 0;
    let totalExpense = 0;
    const expenseByCategory: Record<string, number> = {};
    const expenseByCard: Record<string, number> = {};

    transactions.forEach(tx => {
      const val = Number(tx.amount) || 0;
      if (tx.type === 'income') {
        totalIncome += val;
      } else if (tx.type === 'expense') {
        totalExpense += val;
        
        // Agrupa por Categoria
        const catName = categories.find(c => c.id === tx.category_id)?.name || 'Gerais';
        expenseByCategory[catName] = (expenseByCategory[catName] || 0) + val;

        // Agrupa por Cartão (Se for crédito)
        if (tx.payment_method === 'credit' && tx.credit_card_id) {
          const cardName = cards.find(c => c.id === tx.credit_card_id)?.name || 'Cartão Deletado';
          expenseByCard[cardName] = (expenseByCard[cardName] || 0) + val;
        }
      }
    });

    // Ordena categorias do maior gasto para o menor
    const topCategoriesHTML = Object.entries(expenseByCategory)
      .sort((a, b) => b[1] - a[1])
      .map(([name, amount]) => `
        <tr style="border-bottom: 1px solid #3f3f46;">
          <td style="padding: 12px 0; color: #a1a1aa; font-size: 14px;">${name}</td>
          <td style="padding: 12px 0; color: #f87171; font-size: 14px; text-align: right; font-weight: bold;">R$ ${amount.toLocaleString('pt-BR', {minimumFractionDigits: 2})}</td>
        </tr>
      `).join('');

    const topCardsHTML = Object.entries(expenseByCard)
      .sort((a, b) => b[1] - a[1])
      .map(([name, amount]) => `
        <div style="background-color: #27272a; padding: 12px; border-radius: 8px; margin-bottom: 8px; display: flex; justify-content: space-between;">
          <span style="color: #c084fc; font-weight: bold; font-size: 14px;">${name}</span>
          <span style="color: #f87171; font-weight: bold; font-size: 14px;">R$ ${amount.toLocaleString('pt-BR', {minimumFractionDigits: 2})}</span>
        </div>
      `).join('') || '<p style="color: #71717a; font-size: 12px; font-style: italic;">Nenhum gasto no crédito este mês.</p>';

    // 3. Monta o Template de Email HTML Premium
    const htmlTemplate = `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #09090b; color: #f4f4f5; padding: 40px 20px; max-width: 600px; margin: 0 auto; border-radius: 16px;">
        
        <div style="text-align: center; margin-bottom: 30px;">
          <p style="color: #10b981; font-size: 12px; font-weight: 900; letter-spacing: 2px; margin: 0; text-transform: uppercase;">Camp.OS Ledger</p>
          <h1 style="color: #ffffff; font-size: 24px; font-weight: 900; margin: 5px 0;">Relatório Executivo</h1>
          <p style="color: #a1a1aa; font-size: 14px; margin: 0;">Resumo financeiro de ${name}</p>
        </div>

        <!-- MACRO -->
        <div style="background-color: #18181b; border: 1px solid #27272a; border-radius: 16px; padding: 24px; margin-bottom: 24px;">
          <div style="display: flex; justify-content: space-between; margin-bottom: 16px;">
            <div>
              <p style="color: #a1a1aa; font-size: 10px; text-transform: uppercase; font-weight: bold; letter-spacing: 1px; margin: 0 0 4px 0;">Entrou (Mês)</p>
              <p style="color: #34d399; font-size: 18px; font-weight: 900; margin: 0;">+ R$ ${totalIncome.toLocaleString('pt-BR', {minimumFractionDigits: 2})}</p>
            </div>
            <div style="text-align: right;">
              <p style="color: #a1a1aa; font-size: 10px; text-transform: uppercase; font-weight: bold; letter-spacing: 1px; margin: 0 0 4px 0;">Saiu (Mês)</p>
              <p style="color: #f87171; font-size: 18px; font-weight: 900; margin: 0;">- R$ ${totalExpense.toLocaleString('pt-BR', {minimumFractionDigits: 2})}</p>
            </div>
          </div>
        </div>

        <!-- CATEGORIAS -->
        <h3 style="color: #e4e4e7; font-size: 12px; text-transform: uppercase; letter-spacing: 2px; border-bottom: 1px solid #27272a; padding-bottom: 8px; margin-top: 32px;">Top Despesas (Categorias)</h3>
        <table style="width: 100%; border-collapse: collapse; margin-bottom: 24px;">
          <tbody>
            ${topCategoriesHTML}
          </tbody>
        </table>

        <!-- CARTÕES -->
        <h3 style="color: #e4e4e7; font-size: 12px; text-transform: uppercase; letter-spacing: 2px; border-bottom: 1px solid #27272a; padding-bottom: 8px; margin-top: 32px;">Concentração em Cartões</h3>
        <div style="margin-bottom: 32px;">
          ${topCardsHTML}
        </div>

        <div style="text-align: center; margin-top: 40px; padding-top: 20px; border-top: 1px solid #27272a;">
          <p style="color: #71717a; font-size: 11px;">Este é um email gerado automaticamente pela Inteligência Financeira do Camp.OS Ledger.</p>
        </div>
      </div>
    `;

    // 4. Configuração do Nodemailer
    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: SMTP_EMAIL,
        pass: SMTP_PASS,
      },
    });

    await transporter.sendMail({
      from: `"Camp.OS Ledger" <${SMTP_EMAIL}>`,
      to,
      subject: subject || "Seu Relatório Financeiro",
      html: htmlTemplate,
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Erro de e-mail:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// Helper para parsear o body
async function bodyParse(req: Request) {
  try {
    return await req.json();
  } catch (e) {
    return {};
  }
}