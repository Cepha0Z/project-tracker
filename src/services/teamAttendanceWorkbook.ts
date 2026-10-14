import type { Workbook, Worksheet, Row, Cell } from 'exceljs';
import type { User } from '../types';
import { attendanceDate, attendanceSummary, attendanceTime, hoursLabel, type AttendanceDay } from '../domain/attendanceReport';

const colours={ink:'FF20372F',muted:'FF64736C',line:'FFC8D5CE',soft:'FFF2F6F3',white:'FFFFFFFF',green:'FFDCEEDD',orange:'FFFFE4C4',grey:'FFF0F2F3'};
function cellStyle(cell:Cell,fill=colours.white,bold=false){
  cell.font={name:'Aptos',size:11,bold,color:{argb:colours.ink}};
  cell.fill={type:'pattern',pattern:'solid',fgColor:{argb:fill}};
  const edge={style:'thin' as const,color:{argb:colours.line}};
  cell.border={top:edge,bottom:edge,left:edge,right:edge};
  cell.alignment={vertical:'middle',horizontal:Number(cell.col)===1?'left':'center',wrapText:true,indent:Number(cell.col)===1?1:0};
}
function heading(row:Row){row.height=40;for(let col=1;col<=8;col++){const cell=row.getCell(col);cellStyle(cell,colours.ink,true);cell.font={name:'Aptos',size:11,bold:true,color:{argb:colours.white}};}}
function band(sheet:Worksheet,text:string,fill=colours.soft,title=false){
  const row=sheet.addRow([text]);sheet.mergeCells(row.number,1,row.number,8);row.height=title?38:32;
  const cell=row.getCell(1);cellStyle(cell,fill,true);cell.font={name:'Aptos',size:title?16:10,bold:title,color:{argb:title?colours.white:colours.muted}};
  return row;
}
function configure(sheet:Worksheet){
  sheet.columns=[{width:26},...Array.from({length:7},()=>({width:14}))];
  sheet.views=[{state:'frozen',xSplit:1,ySplit:5,showGridLines:false}];
  sheet.pageSetup={paperSize:9,orientation:'landscape',fitToPage:true,fitToWidth:1,fitToHeight:0,margins:{left:.3,right:.3,top:.4,bottom:.4,header:.15,footer:.15}};
  sheet.headerFooter={oddFooter:'&LStudio Projects · Attendance · India time&RPage &P of &N'};
}
const dateLabel=(date:string)=>new Date(`${date}T00:00:00Z`).toLocaleDateString('en-GB',{day:'2-digit',month:'short',timeZone:'UTC'});

// A bounded eight-column layout: one summary, then monthly tabs with stacked seven-day blocks.
export function buildTeamAttendanceWorkbook(workbook:Workbook,employees:User[],rows:AttendanceDay[],dates:string[],start:string,end:string){
  const summary=workbook.addWorksheet('Summary');configure(summary);
  band(summary,'STUDIO PROJECTS / ATTENDANCE',colours.ink,true);
  band(summary,`${start} to ${end} · All Employees · India time`);
  band(summary,'Open a month tab for seven-day grids. Each employee appears once per block, with dates across the top.');
  band(summary,'Green: complete, 9+ hours. Orange: complete, under 9 hours. Grey: incomplete or missing.');
  heading(summary.addRow(['Employee','Total days','Complete days','9+ hour days','Under 9-hour days','Incomplete / missing','Recorded hours','Average / complete day']));
  summary.getRow(5).height=48;
  function addSummary(name:string,selected:AttendanceDay[],overall=false){
    const totals=attendanceSummary(selected),row=summary.addRow([name,totals.days,totals.complete,totals.ninePlus,totals.underNine,totals.incomplete,totals.total/24,totals.average/24]);row.height=34;
    row.eachCell((cell,col)=>cellStyle(cell,overall?colours.ink:col===4?colours.green:col===5?colours.orange:row.number%2?colours.soft:colours.white,col===1||overall));
    if(overall)row.eachCell(cell=>{cell.font={name:'Aptos',size:11,bold:true,color:{argb:colours.white}};});
    row.getCell(7).numFmt='[h]:mm';row.getCell(8).numFmt='[h]:mm';
  }
  for(const employee of employees)addSummary(employee.name,rows.filter(row=>row.user.id===employee.id));
  addSummary('All Employees',rows,true);
  band(summary,'Overall day counts are employee-days. Average uses completed employee-days only.');
  band(summary,'Recorded hours include closed shifts on incomplete days. Open shifts and gaps add no assumed time.');
  summary.autoFilter={from:'A5',to:`H${5+employees.length}`};

  const months=new Map<string,string[]>();
  for(const date of dates){const key=date.slice(0,7);months.set(key,[...(months.get(key)||[]),date]);}
  const lookup=new Map(rows.map(row=>[`${row.user.id}/${row.date}`,row]));
  for(const [month,monthDates] of months){
    const label=new Date(`${month}-01T00:00:00Z`).toLocaleDateString('en-GB',{month:'short',year:'numeric',timeZone:'UTC'});
    const sheet=workbook.addWorksheet(label);configure(sheet);
    // Freeze the month heading, not the first block's dates: later blocks have their own date headers.
    sheet.views=[{state:'frozen',xSplit:1,ySplit:3,showGridLines:false}];
    sheet.pageSetup.printTitlesRow='1:3';
    band(sheet,`STUDIO PROJECTS / ${label.toUpperCase()}`,colours.ink,true);
    band(sheet,`${dateLabel(monthDates[0])} – ${dateLabel(monthDates.at(-1)!)} · All Employees · India time`);
    band(sheet,'Hours = completed shifts. Grey = missing / incomplete. Cell notes contain check-in/out details.');
    for(let offset=0;offset<monthDates.length;offset+=7){
      const block=monthDates.slice(offset,offset+7);
      if(offset)sheet.addRow([]);
      const blockTitle=band(sheet,`${dateLabel(block[0])} – ${dateLabel(block.at(-1)!)} / ${label}`);
      if(offset)sheet.getRow(blockTitle.number-1).addPageBreak();
      const header=sheet.addRow(['Employee',...block.map(date=>new Date(`${date}T00:00:00Z`))]);heading(header);
      for(let i=0;i<block.length;i++)header.getCell(i+2).numFmt='dd mmm"\n"ddd';
      for(const employee of employees){
        const row=sheet.addRow([employee.name]);row.height=42;cellStyle(row.getCell(1),colours.soft,true);
        for(let i=0;i<7;i++){
          const cell=row.getCell(i+2),date=block[i];
          if(!date){cellStyle(cell,colours.soft);continue;}
          const item=lookup.get(`${employee.id}/${date}`)!;
          cell.value=item.complete?item.hours/24:item.entries.length?`Incomplete\n${hoursLabel(item.hours)}`:'Missing';cell.numFmt='[h]:mm';
          cellStyle(cell,!item.complete?colours.grey:item.hours>=9?colours.green:colours.orange,item.complete);
          cell.note=`${employee.name} · ${date}\n${item.status}\n${item.entries.map(entry=>`In: ${attendanceDate(entry.clockInAt)} ${attendanceTime(entry.clockInAt)}; out: ${entry.clockOutAt?`${attendanceDate(entry.clockOutAt)} ${attendanceTime(entry.clockOutAt)}`:'Missing'}`).join('\n')||'No check-in or check-out recorded.'}\nRecorded hours: ${hoursLabel(item.hours)} (India time)`;
        }
      }
    }
    sheet.pageSetup.printArea=`A1:H${sheet.rowCount}`;
    const link=summary.addRow([{text:`Open ${label}`,hyperlink:`#'${label}'!A1`}]);summary.mergeCells(link.number,1,link.number,8);link.height=28;link.getCell(1).font={name:'Aptos',size:11,color:{argb:'FF276647'},underline:true};
  }
  summary.pageSetup.printArea=`A1:H${summary.rowCount}`;
  return workbook;
}
