/* ================================================================
   استيراد بيانات من ملف الإكسل (نفس الصيغة المستخدمة سابقاً في المنصة) إلى قاعدة بيانات Postgres/Supabase.
   الاستخدام:  node server/import-from-excel.js path/to/file.xlsx
   يحذف البيانات القديمة في الجداول الأربعة ثم يستورد من الملف من جديد (استيراد كامل نظيف).
================================================================ */
require('dotenv').config();
const XLSX = require('xlsx');
const pool = require('./db');

function normHeader(h){ return String(h==null?'':h).trim(); }
function findSheet(wb, exact, contains){
  if(wb.Sheets[exact]) return exact;
  const found = wb.SheetNames.find(n => n.toLowerCase().replace(/\s|_/g,'').includes(contains.toLowerCase()));
  return found || null;
}
function sheetToRows(ws){
  if(!ws) return [];
  return XLSX.utils.sheet_to_json(ws, {header:1, raw:true, defval:null});
}
function headerIndex(headers, name){
  const norm = headers.map(normHeader);
  let i = norm.indexOf(name);
  if(i>=0) return i;
  i = norm.findIndex(h => h.toLowerCase()===name.toLowerCase());
  return i;
}
function numOrNull(v){
  if(v===null || v===undefined || v==='') return null;
  const n = Number(v);
  return isNaN(n) ? null : n;
}
function num0(v){ const n = numOrNull(v); return n==null ? 0 : n; }

/* يبني جملة INSERT بعدة صفوف دفعة واحدة بترقيم بارامترات $1,$2... متسلسل (أسرع من صف صف) */
async function bulkInsert(client, table, columns, rows){
  if(!rows.length) return;
  const chunkSize = 500; // نتجنب تجاوز حد عدد البارامترات لكل استعلام
  for(let start=0; start<rows.length; start+=chunkSize){
    const chunk = rows.slice(start, start+chunkSize);
    const values = [];
    const placeholders = chunk.map((row, i) => {
      const base = i * columns.length;
      values.push(...row);
      return '(' + columns.map((_, j) => `$${base + j + 1}`).join(',') + ')';
    }).join(',');
    await client.query(
      `INSERT INTO ${table} (${columns.join(',')}) VALUES ${placeholders}`,
      values
    );
  }
}

async function main(){
  const filePath = process.argv[2];
  if(!filePath){
    console.error('الاستخدام: node server/import-from-excel.js path/to/file.xlsx');
    process.exit(1);
  }

  const wb = XLSX.readFile(filePath, {cellDates:false});

  /* ---- Federation_data ---- */
  const fedSheetName = findSheet(wb, 'Federation_data', 'federation');
  const fedOut = [];
  if(fedSheetName){
    const rows = sheetToRows(wb.Sheets[fedSheetName]);
    if(rows.length){
      const h = rows[0];
      const iId=headerIndex(h,'Federation ID'), iEn=headerIndex(h,'Federation Name (EN)'),
            iAr=headerIndex(h,'Federation Name (AR)'), iStream=headerIndex(h,'Stream'),
            iTier=headerIndex(h,'Tier'), iCat=headerIndex(h,'Category'), iSize=headerIndex(h,'Size'),
            iUser=headerIndex(h,'Username'), iPass=headerIndex(h,'Password'), iRev=headerIndex(h,'Reviewer');
      for(let r=1;r<rows.length;r++){
        const row = rows[r]; if(!row || row[iId]==null) continue;
        fedOut.push([
          Number(row[iId]),
          iEn>=0 ? String(row[iEn]??'').trim() : '',
          iAr>=0 ? String(row[iAr]??'').trim() : ('اتحاد #'+row[iId]),
          iStream>=0 ? String(row[iStream]??'غير محدد').trim() : 'غير محدد',
          iTier>=0 ? String(row[iTier]??'—').trim() : '—',
          iCat>=0 ? String(row[iCat]??'غير محدد').trim() : 'غير محدد',
          iSize>=0 ? String(row[iSize]??'غير محدد').trim() : 'غير محدد',
          iUser>=0 ? String(row[iUser]??'').trim() : '',
          iPass>=0 ? String(row[iPass]??'').trim() : '',
          iRev>=0 ? String(row[iRev]??'').trim() : '',
        ]);
      }
    }
  }

  /* ---- Activities_data ---- */
  const actSheetName = findSheet(wb, 'Activities_data', 'activities');
  const actOut = [];
  if(actSheetName){
    const rows = sheetToRows(wb.Sheets[actSheetName]);
    if(rows.length){
      const h = rows[0];
      const iId=headerIndex(h,'Activities ID'), iFed=headerIndex(h,'Federation ID'),
            iL3=headerIndex(h,'Level 3'), iName=headerIndex(h,'Tournament Name'),
            iQ=headerIndex(h,'Quarter Period'), iCountry=headerIndex(h,'Country'),
            iCity=headerIndex(h,'City'), iPCat=headerIndex(h,'Participant Category'),
            iClass=headerIndex(h,'Classification'), iGender=headerIndex(h,'Category'),
            iStaff=headerIndex(h,'No of Technical Administrative Staff'),
            iDays=headerIndex(h,'No. of Days'),
            iExpP=headerIndex(h,'Expected No. of Participating Players'),
            iActP=headerIndex(h,'Actual No. of Participating Players'),
            iExpG=headerIndex(h,'Expected Gold Medals'), iActG=headerIndex(h,'Actual Gold Medals'),
            iExpS=headerIndex(h,'Expected Silver Medals'), iActS=headerIndex(h,'Actual Silver Medals'),
            iExpB=headerIndex(h,'Expected Bronze Medals'), iActB=headerIndex(h,'Actual Bronze Medals');
      for(let r=1;r<rows.length;r++){
        const row = rows[r]; if(!row || row[iId]==null || row[iFed]==null) continue;
        actOut.push([
          Number(row[iId]), Number(row[iFed]),
          iL3>=0 ? String(row[iL3]??'غير محدد').trim() : 'غير محدد',
          iName>=0 ? String(row[iName]??'بدون اسم').trim() : 'بدون اسم',
          iQ>=0 ? String(row[iQ]??'غير محدد').trim() : 'غير محدد',
          iCountry>=0 ? String(row[iCountry]??'غير محدد').trim() : 'غير محدد',
          iCity>=0 ? String(row[iCity]??'غير محدد').trim() : 'غير محدد',
          iPCat>=0 ? String(row[iPCat]??'غير محدد').trim() : 'غير محدد',
          iClass>=0 ? String(row[iClass]??'غير محدد').trim() : 'غير محدد',
          iGender>=0 ? String(row[iGender]??'غير محدد').trim() : 'غير محدد',
          num0(row[iStaff]), num0(row[iDays]), num0(row[iExpP]), num0(row[iActP]),
          numOrNull(row[iExpG]), numOrNull(row[iActG]),
          numOrNull(row[iExpS]), numOrNull(row[iActS]),
          numOrNull(row[iExpB]), numOrNull(row[iActB]),
        ]);
      }
    }
  }

  /* ---- Financial_data ---- */
  const finSheetName = findSheet(wb, 'Financial_data', 'financial');
  const finOut = [];
  if(finSheetName){
    const rows = sheetToRows(wb.Sheets[finSheetName]);
    if(rows.length){
      const h = rows[0];
      const iFed=headerIndex(h,'Federation ID'), iQ=headerIndex(h,'Quarter'), iType=headerIndex(h,'Type'),
            iL1=headerIndex(h,'Level 1'), iL2=headerIndex(h,'Level 2'), iL3=headerIndex(h,'Level 3'),
            iL4=headerIndex(h,'Level 4'), iL5=headerIndex(h,'Level 5'), iAmt=headerIndex(h,'Total Amount'),
            iAct=headerIndex(h,'Activities ID');
      for(let r=1;r<rows.length;r++){
        const row = rows[r]; if(!row || row[iFed]==null) continue;
        const typeStr = iType>=0 ? String(row[iType]??'') : '';
        finOut.push([
          Number(row[iFed]),
          iQ>=0 ? String(row[iQ]??'غير محدد').trim() : 'غير محدد',
          /موازن/.test(typeStr),
          iL1>=0 ? String(row[iL1]??'غير محدد').trim() : 'غير محدد',
          iL2>=0 ? String(row[iL2]??'غير محدد').trim() : 'غير محدد',
          iL3>=0 ? String(row[iL3]??'غير محدد').trim() : 'غير محدد',
          iL4>=0 ? String(row[iL4]??'غير محدد').trim() : 'غير محدد',
          iL5>=0 ? String(row[iL5]??'غير محدد').trim() : 'غير محدد',
          num0(row[iAmt]),
          iAct>=0 ? numOrNull(row[iAct]) : null,
        ]);
      }
    }
  }

  /* ---- Reviewer ---- */
  const revSheetName = findSheet(wb, 'Reviewer', 'reviewer');
  const revOut = [];
  if(revSheetName){
    const rows = sheetToRows(wb.Sheets[revSheetName]);
    if(rows.length){
      const h = rows[0];
      const iName=headerIndex(h,'Reviewer'), iType=headerIndex(h,'Reviewer_taybe'),
            iUser=headerIndex(h,'Reviewer_name'), iPass=headerIndex(h,'Reviewer_password');
      for(let r=1;r<rows.length;r++){
        const row = rows[r]; if(!row || row[iUser]==null) continue;
        revOut.push([
          iName>=0 ? String(row[iName]??'').trim() : '',
          iType>=0 ? String(row[iType]??'').trim() : '',
          iUser>=0 ? String(row[iUser]??'').trim() : '',
          iPass>=0 ? String(row[iPass]??'').trim() : '',
        ]);
      }
    }
  }

  console.log(`تم استخراج من الملف: ${fedOut.length} اتحاد، ${actOut.length} فعالية، ${finOut.length} سجل مالي، ${revOut.length} مراجع.`);
  if(!fedOut.length){ console.error('لم يتم العثور على بيانات اتحادات صالحة — تحقق من اسم الملف والأوراق.'); process.exit(1); }

  const client = await pool.connect();
  try{
    await client.query('BEGIN');
    // الترتيب مهم بسبب مفاتيح FOREIGN KEY: نحذف الأبناء أولاً
    await client.query('DELETE FROM financial');
    await client.query('DELETE FROM activities');
    await client.query('DELETE FROM reviewers');
    await client.query('DELETE FROM federations');

    await bulkInsert(client, 'federations',
      ['id','name_en','name_ar','stream','tier','category','size','username','password','reviewer'],
      fedOut);

    await bulkInsert(client, 'activities',
      ['id','federation_id','level3','name','quarter','country','city','participant_category','classification','gender',
       'staff','days','expected_players','actual_players','expected_gold','actual_gold','expected_silver','actual_silver','expected_bronze','actual_bronze'],
      actOut);

    await bulkInsert(client, 'financial',
      ['federation_id','quarter','is_budget','level1','level2','level3','level4','level5','amount','activity_id'],
      finOut);

    await bulkInsert(client, 'reviewers', ['name','type','username','password'], revOut);

    await client.query('COMMIT');
    console.log('✔ تم الاستيراد بنجاح.');
  }catch(err){
    await client.query('ROLLBACK');
    console.error('فشل الاستيراد، تم التراجع عن كل التغييرات:', err.message);
    process.exitCode = 1;
  }finally{
    client.release();
    await pool.end();
  }
}

main();
