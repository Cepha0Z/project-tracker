import type { AppData, User } from '../types';
import { attendanceDays, attendanceSummary, calendarDays, attendanceDate as attendanceDateForNote, attendanceTime, hoursLabel, ATTENDANCE_ZONE } from '../domain/attendanceReport';
import { connectedPeople } from '../domain/people';

export async function buildAttendanceWorkbook(data:AppData,user:User,employeeId:string,start:string,end:string){
  if(user.access!=='admin')throw new Error('Only admins can export attendance.');
  const employees=connectedPeople(data).filter(person=>person.access==='employee'&&(!employeeId||person.id===employeeId));
  if(!employees.length)throw new Error('Select an available employee.');
  const rows=attendanceDays(employees,data.attendanceEntries,start,end);
  if(rows.length>100000)throw new Error('Please choose a shorter reporting period.');
  const dates=calendarDays(start,end);
  if(!employeeId&&dates.length>16383)throw new Error('Please choose a shorter reporting period.');
  const {default:ExcelJS}=await import('exceljs');
  const workbook=new ExcelJS.Workbook(),sheet=workbook.addWorksheet('Attendance');
  workbook.creator='Studio Projects';
  const palette={ink:'FF20372F',muted:'FF64736C',line:'FFC8D5CE',soft:'FFF2F6F3',white:'FFFFFFFF'};
  const border={top:{style:'thin' as const,color:{argb:palette.line}},bottom:{style:'thin' as const,color:{argb:palette.line}},left:{style:'thin' as const,color:{argb:palette.line}},right:{style:'thin' as const,color:{argb:palette.line}}};
  sheet.columns=[{width:17},{width:16},{width:26},{width:23},{width:23},{width:20},{width:38},{width:22}];
  sheet.addRow(['STUDIO PROJECTS  /  ATTENDANCE']);sheet.mergeCells('A1:H1');sheet.getRow(1).height=42;sheet.getCell('A1').font={name:'Aptos',bold:true,size:19,color:{argb:palette.white}};sheet.getCell('A1').fill={type:'pattern',pattern:'solid',fgColor:{argb:palette.ink}};sheet.getCell('A1').alignment={vertical:'middle',indent:1};
  sheet.addRow([`${start} to ${end}  |  ${employeeId?employees[0].name:'All Employees'}  |  ${ATTENDANCE_ZONE}`]);sheet.mergeCells('A2:H2');sheet.getRow(2).height=28;sheet.getCell('A2').font={name:'Aptos',size:11,bold:true,color:{argb:palette.ink}};sheet.getCell('A2').fill={type:'pattern',pattern:'solid',fgColor:{argb:'FFE5EDE7'}};sheet.getCell('A2').alignment={vertical:'middle',indent:1};
  sheet.addRow(['Hours sum completed shifts; gaps and open shifts add no assumed time. Overnight shifts belong to their check-in date.']);sheet.mergeCells('A3:H3');sheet.getRow(3).height=32;sheet.getCell('A3').alignment={wrapText:true};
  sheet.addRow(['Green: complete, 9+ hours. Orange: complete, under 9 hours. Grey: incomplete/missing.']);sheet.mergeCells('A4:H4');
  for(const number of [3,4]){const cell=sheet.getCell(`A${number}`);cell.font={name:'Aptos',size:10,color:{argb:palette.muted}};cell.alignment={vertical:'middle',wrapText:true,indent:1};sheet.getRow(number).height=30;}
  const header=sheet.addRow(employeeId?['Date','Day of week','Employee name','Check-in time','Check-out time','Total hours worked','Daily status']:['Employee',...dates.map(date=>new Date(`${date}T00:00:00Z`))]);
  function styleHeader(row:typeof header){row.height=38;row.eachCell(cell=>{cell.font={name:'Aptos',size:11,bold:true,color:{argb:palette.white}};cell.fill={type:'pattern',pattern:'solid',fgColor:{argb:palette.ink}};cell.border=border;cell.alignment={vertical:'middle',wrapText:true,indent:1};});}
  styleHeader(header);
  if(!employeeId){
    sheet.getColumn(1).width=26;
    dates.forEach((_,index)=>{sheet.getColumn(index+2).width=19;header.getCell(index+2).numFmt='dd mmm yyyy"\n"ddd';header.getCell(index+2).alignment={horizontal:'center',vertical:'middle',wrapText:true};});
    sheet.getCell('A3').value='Each date cell shows recorded hours. Incomplete days remain grey; check-in/out details are available in cell notes. Overnight shifts belong to their check-in date.';
    const byEmployeeDate=new Map(rows.map(item=>[`${item.user.id}/${item.date}`,item]));
    for(const employee of employees){
      const row=sheet.addRow([employee.name]);row.height=44;
      const name=row.getCell(1);name.font={name:'Aptos',size:11,bold:true,color:{argb:palette.ink}};name.fill={type:'pattern',pattern:'solid',fgColor:{argb:palette.soft}};name.border=border;name.alignment={vertical:'middle',wrapText:true,indent:1};
      dates.forEach((date,index)=>{
        const item=byEmployeeDate.get(`${employee.id}/${date}`)!,cell=row.getCell(index+2);
        cell.value=item.complete?item.hours/24:item.entries.length?`Incomplete\n${hoursLabel(item.hours)} recorded`:'Missing';cell.numFmt='[h]:mm';
        cell.fill={type:'pattern',pattern:'solid',fgColor:{argb:!item.complete?'FFF0F2F3':item.hours>=9?'FFDCEEDD':'FFFFE4C4'}};cell.border=border;
        cell.font={name:'Aptos',size:11,bold:item.complete,color:{argb:palette.ink}};cell.alignment={horizontal:'center',vertical:'middle',wrapText:true};
        cell.note=`${employee.name} · ${date}\n${item.status}\n${item.entries.map(entry=>`Check-in: ${attendanceTime(entry.clockInAt)}; check-out: ${entry.clockOutAt?`${attendanceDateForNote(entry.clockOutAt)} ${attendanceTime(entry.clockOutAt)}`:'Missing'}`).join('\n')||'No check-in or check-out recorded.'}\nRecorded hours: ${hoursLabel(item.hours)} (India time)`;
      });
    }
    sheet.autoFilter={from:'A5',to:{row:5+employees.length,column:dates.length+1}};sheet.views=[{state:'frozen',xSplit:1,ySplit:5,showGridLines:false}];
  }else{
  const excelDate=(value:string)=>new Date(Date.parse(value)+330*60000); // Excel wall-clock IST, stored as a numeric date.
  for(const item of rows){
    const row=sheet.addRow([new Date(`${item.date}T00:00:00Z`),new Date(item.date).toLocaleDateString('en-GB',{weekday:'long',timeZone:'UTC'}),item.user.name,item.checkIn?excelDate(item.checkIn):'Missing',item.checkOut?excelDate(item.checkOut):item.checkIn?'Missing / incomplete':'Missing',item.hours/24,item.status]);
    row.height=32;row.getCell(1).numFmt='dd mmm yyyy';row.getCell(4).numFmt='dd mmm hh:mm';row.getCell(5).numFmt='dd mmm hh:mm';row.getCell(6).numFmt='[h]:mm';
    const colour=!item.complete?'FFF0F2F3':item.hours>=9?'FFDCEEDD':'FFFFE4C4';
    for(let col=1;col<=7;col++){const cell=row.getCell(col);cell.fill={type:'pattern',pattern:'solid',fgColor:{argb:colour}};cell.border=border;cell.font={name:'Aptos',size:11,bold:col===3||col===6,color:{argb:palette.ink}};cell.alignment={vertical:'middle',horizontal:col>=4&&col<=6?'center':'left',wrapText:true,indent:col>=4&&col<=6?0:1};}
  }
  sheet.autoFilter={from:'A5',to:`G${5+rows.length}`};sheet.views=[{state:'frozen',ySplit:5,showGridLines:false}];
  }
  sheet.addRow([]);const summaryTitle=sheet.addRow(['EMPLOYEE SUMMARY']);sheet.mergeCells(`A${summaryTitle.number}:H${summaryTitle.number}`);summaryTitle.height=34;summaryTitle.font={name:'Aptos',size:13,bold:true,color:{argb:palette.ink}};summaryTitle.getCell(1).alignment={vertical:'middle',indent:1};summaryTitle.getCell(1).fill={type:'pattern',pattern:'solid',fgColor:{argb:'FFE5EDE7'}};
  styleHeader(sheet.addRow(['Employee','Total days','Complete days','9+ hour days','Under 9-hour days','Incomplete / missing','Total recorded hours','Avg hours / complete day']));
  function addSummary(name:string,selected:typeof rows){const value=attendanceSummary(selected);const row=sheet.addRow([name,value.days,value.complete,value.ninePlus,value.underNine,value.incomplete,value.total/24,value.average/24]);row.height=32;row.getCell(7).numFmt='[h]:mm';row.getCell(8).numFmt='[h]:mm';row.eachCell((cell,col)=>{cell.border=border;cell.font={name:'Aptos',size:11,bold:col===1,color:{argb:palette.ink}};cell.alignment={vertical:'middle',horizontal:col===1?'left':'center',indent:col===1?1:0,wrapText:true};cell.fill={type:'pattern',pattern:'solid',fgColor:{argb:col===4?'FFDCEEDD':col===5?'FFFFE4C4':row.number%2?palette.white:palette.soft}};});}
  for(const employee of employees)addSummary(employee.name,rows.filter(row=>row.user.id===employee.id));
  function addFootnote(text:string){const row=sheet.addRow([text]);sheet.mergeCells(`A${row.number}:H${row.number}`);row.height=30;row.getCell(1).font={name:'Aptos',size:10,color:{argb:palette.muted}};row.getCell(1).alignment={vertical:'middle',wrapText:true,indent:1};}
  if(!employeeId){addSummary('All Employees',rows);sheet.lastRow!.eachCell(cell=>{cell.font={name:'Aptos',size:11,bold:true,color:{argb:palette.white}};cell.fill={type:'pattern',pattern:'solid',fgColor:{argb:palette.ink}};});addFootnote('Overall day counts are employee-days. Average uses completed employee-days only.');}
  addFootnote('Total recorded hours includes completed shifts on incomplete days. Average excludes incomplete days.');
  const lastColumn=sheet.getColumn(Math.max(8,employeeId?8:dates.length+1)).letter;
  sheet.pageSetup={paperSize:9,orientation:'landscape',fitToPage:true,fitToWidth:employeeId?1:0,fitToHeight:0,printTitlesRow:'5:5',...(!employeeId?{printTitlesColumn:'A:A'}:{}),printArea:`A1:${lastColumn}${sheet.rowCount}`,margins:{left:.3,right:.3,top:.4,bottom:.4,header:.15,footer:.15}};
  sheet.headerFooter={oddFooter:'&LStudio Projects · Attendance&RPage &P of &N'};
  return workbook;
}

export async function downloadAttendance(data:AppData,user:User,employeeId:string,start:string,end:string){
  const workbook=await buildAttendanceWorkbook(data,user,employeeId,start,end),buffer=await workbook.xlsx.writeBuffer();
  const blob=new Blob([new Uint8Array(buffer)],{type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'});
  const url=URL.createObjectURL(blob),anchor=document.createElement('a');anchor.href=url;anchor.download=`attendance-${start}-to-${end}.xlsx`;document.body.append(anchor);anchor.click();anchor.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);
}
