import { NextResponse } from 'next/server';
import nodemailer from 'nodemailer';
import { createClient } from "@supabase/supabase-js";

const SMTP_EMAIL = process.env.SMTP_EMAIL || "camp.os.alertas@gmail.com";
const SMTP_PASS = process.env.SMTP_PASS || "";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
const supabase = createClient(supabaseUrl, supabaseAnonKey);

export async function POST(req: Request) {
  try {
    const { to, subject, name, family_id } = await bodyParse(req);
    
    if (!to || !family_id) {
      return NextResponse.json({ error: 'Faltam dados obrigatórios.' }, { status: 400 });
    }

    const dateObj = new Date();
    const startOfMonth = new Date(dateObj.getFullYear(), dateObj.getMonth(), 1).toISOString();
    const endOfMonth = new Date(dateObj.getFullYear(), dateObj.getMonth() + 1, 0, 23, 59, 59).toISOString();

    const [txRes, catRes, cardRes] = await Promise.all([
      supabase
        .from('transactions')
        .select('*')
        .eq('family_id', family_id)
        .gte('date', startOfMonth)
        .lte('date', endOfMonth),
      supabase.from('categories').select('id, name, type'),
      supabase.from('credit_cards').select('id, name')
    ]);

    const transactions = txRes.data || [];
    const categories = catRes.data || [];
    const cards = cardRes.data || [];

    let totalIncome = 0; 
    let totalExpense = 0;
    const expenseByCategory: Record<string, number> = {};
    const expenseByCard: Record<string, number> = {};
    
    // Arrays para visão semanal
    let week1 = 0; 
    let week2 = 0; 
    let week3 = 0; 
    let week4 = 0;

    transactions.forEach(tx => {
      const val = Number(tx.amount) || 0;
      
      if (tx.type === 'income') {
        totalIncome += val;
      } else if (tx.type === 'expense') {
        totalExpense += val;
        
        // Agrupa Semanas
        const day = new Date(tx.date).getDate();
        if (day <= 7) {
          week1 += val;
        } else if (day <= 14) {
          week2 += val;
        } else if (day <= 21) {
          week3 += val;
        } else {
          week4 += val;
        }

        // Agrupa por Categoria
        const catName = categories.find(c => c.id === tx.category_id)?.name || 'Gerais';
        expenseByCategory[catName] = (expenseByCategory[catName] || 0) + val;

        // Agrupa por Cartão
        if (tx.payment_method === 'credit' && tx.credit_card_id) {
          const cardName = cards.find(c => c.id === tx.credit_card_id)?.name || 'Cartão Deletado';
          expenseByCard[cardName] = (expenseByCard[cardName] || 0) + val;
        }
      }
    });

    const weeklyHTML = `
      <div style="display: flex; gap: 8px; margin-bottom: 24px;">
        <div style="flex: 1; background: #27272a; padding: 10px; border-radius: 8px; text-align: center;">
          <p style="margin:0; font-size:10px; color:#a1a1aa">Semana 1</p>
          <p style="margin:0; font-size:14px; font-weight:bold; color:#fff">R$ ${week1.toFixed(0)}</p>
        </div>
        <div style="flex: 1; background: #27272a; padding: 10px; border-radius: 8px; text-align: center;">
          <p style="margin:0; font-size:10px; color:#a1a1aa">Semana 2</p>
          <p style="margin:0; font-size:14px; font-weight:bold; color:#fff">R$ ${week2.toFixed(0)}</p>
        </div>
        <div style="flex: 1; background: #27272a; padding: 10px; border-radius: 8px; text-align: center;">
          <p style="margin:0; font-size:10px; color:#a1a1aa">Semana 3</p>
          <p style="margin:0; font-size:14px; font-weight:bold; color:#fff">R$ ${week3.toFixed(0)}</p>
        </div>
        <div style="flex: 1; background: #27272a; padding: 10px; border-radius: 8px; text-align: center;">
          <p style="margin:0; font-size:10px; color:#a1a1aa">Semana 4+</p>
          <p style="margin:0; font-size:14px; font-weight:bold; color:#fff">R$ ${week4.toFixed(0)}</p>
        </div>
      </div>
    `;

    const topCategoriesHTML = Object.entries(expenseByCategory)
      .sort((a, b) => b[1] - a[1])
      .map(([catName, amount]) => `
        <tr style="border-bottom: 1px solid #3f3f46;">
          <td style="padding: 12px 0; color: #a1a1aa; font-size: 14px;">${catName}</td>
          <td style="padding: 12px 0; color: #f87171; font-size: 14px; text-align: right; font-weight: bold;">R$ ${amount.toLocaleString('pt-BR', {minimumFractionDigits: 2})}</td>
        </tr>
      `).join('');
      
    const topCardsHTML = Object.entries(expenseByCard)
      .sort((a, b) => b[1] - a[1])
      .map(([cardName, amount]) => `
        <div style="background-color: #27272a; padding: 12px; border-radius: 8px; margin-bottom: 8px; display: flex; justify-content: space-between;">
          <span style="color: #c084fc; font-weight: bold; font-size: 14px;">${cardName}</span>
          <span style="color: #f87171; font-weight: bold; font-size: 14px;">R$ ${amount.toLocaleString('pt-BR', {minimumFractionDigits: 2})}</span>
        </div>
      `).join('') || '<p style="color: #71717a; font-size: 12px;">Sem gastos no crédito este mês.</p>';

    const htmlTemplate = `
      <div style="font-family: Arial, sans-serif; background-color: #09090b; color: #f4f4f5; padding: 40px 20px; max-width: 600px; margin: 0 auto; border-radius: 16px;">
        <div style="text-align: center; margin-bottom: 30px;">
          <p style="color: #10b981; font-size: 12px; font-weight: bold; text-transform: uppercase;">Camp.OS Ledger</p>
          <h1 style="color: #fff; margin: 5px 0;">Relatório de Despesas</h1>
          <p style="color: #a1a1aa; font-size: 14px; margin: 0;">Resumo financeiro de ${name}</p>
        </div>
        
        <div style="background-color: #18181b; border: 1px solid #27272a; border-radius: 16px; padding: 24px; margin-bottom: 24px;">
          <div style="display: flex; justify-content: space-between;">
            <div>
              <p style="color: #a1a1aa; font-size: 10px; text-transform: uppercase; margin: 0 0 4px 0;">Entrou (Mês)</p>
              <p style="color: #34d399; font-size: 18px; font-weight: bold; margin: 0;">+ R$ ${totalIncome.toLocaleString('pt-BR', {minimumFractionDigits: 2})}</p>
            </div>
            <div style="text-align: right;">
              <p style="color: #a1a1aa; font-size: 10px; text-transform: uppercase; margin: 0 0 4px 0;">Saiu (Mês)</p>
              <p style="color: #f87171; font-size: 18px; font-weight: bold; margin: 0;">- R$ ${totalExpense.toLocaleString('pt-BR', {minimumFractionDigits: 2})}</p>
            </div>
          </div>
        </div>
        
        <h3 style="color: #e4e4e7; font-size: 12px; text-transform: uppercase; border-bottom: 1px solid #27272a; padding-bottom: 8px;">Gasto Semanal</h3>
        ${weeklyHTML}
        
        <h3 style="color: #e4e4e7; font-size: 12px; text-transform: uppercase; border-bottom: 1px solid #27272a; padding-bottom: 8px; margin-top: 32px;">Top Despesas (Categorias)</h3>
        <table style="width: 100%; border-collapse: collapse; margin-bottom: 24px;">
          <tbody>
            ${topCategoriesHTML}
          </tbody>
        </table>
        
        <h3 style="color: #e4e4e7; font-size: 12px; text-transform: uppercase; border-bottom: 1px solid #27272a; padding-bottom: 8px; margin-top: 32px;">Concentração em Cartões</h3>
        <div style="margin-bottom: 32px;">
          ${topCardsHTML}
        </div>
        
        <div style="text-align: center; margin-top: 40px; padding-top: 20px; border-top: 1px solid #27272a;">
          <p style="color: #71717a; font-size: 11px;">Este é um e-mail gerado automaticamente pela Inteligência Financeira do Camp.OS Ledger.</p>
        </div>
      </div>
    `;

    const transporter = nodemailer.createTransport({ 
      service: 'gmail', 
      auth: { 
        user: SMTP_EMAIL, 
        pass: SMTP_PASS 
      } 
    });

    await transporter.sendMail({ 
      from: `"Camp.OS Ledger" <${SMTP_EMAIL}>`, 
      to, 
      subject: subject || "Relatório Financeiro Semanal e Mensal", 
      html: htmlTemplate 
    });

    return NextResponse.json({ success: true });
  } catch (error: any) { 
    return NextResponse.json({ error: error.message }, { status: 500 }); 
  }
}

async function bodyParse(req: Request) { 
  try { 
    return await req.json(); 
  } catch (e) { 
    return {}; 
  } 
}