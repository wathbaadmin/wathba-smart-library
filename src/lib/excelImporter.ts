import * as XLSX from 'xlsx';
import { EphemeralStudentCredential, Student } from '../types';
import {
  generateStudentAccessCode,
  generateUniqueStudentQrToken,
  hashAccessCodeSync,
  normalizeStudentCode,
  sanitizeStudentForPersistence,
} from './studentAuthService';

export interface ParsedStudentRow {
  fullName: string;
  grade: string;
  stage: string;
  groupName: string;
  internalId?: string;
}

export function parseStudentExcel(file: File): Promise<ParsedStudentRow[]> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (e) => {
      try {
        const buffer = e.target?.result;
        const workbook = XLSX.read(buffer, { type: 'binary' });
        const firstSheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[firstSheetName];
        const jsonData = XLSX.utils.sheet_to_json<any>(sheet);

        const parsed: ParsedStudentRow[] = jsonData.map((row, index) => {
          const fullName =
            row['الاسم'] || row['اسم الطالب'] || row['الاسم الكامل'] || row['name'] || `طالب_${index + 1}`;
          const grade = row['الصف'] || row['الصف الدراسي'] || row['grade'] || 'الصف الرابع';
          const stage = row['المرحلة'] || row['المرحلة الدراسية'] || row['stage'] || 'الابتدائية';
          const groupName = row['المجموعة'] || row['اسم المجموعة'] || row['group'] || 'المجموعة العامة';
          const internalId =
            row['كود الطالب'] ||
            row['الرقم التعريفي'] ||
            row['رقم الطالب'] ||
            row['id'] ||
            `STU-${1000 + index + 1}`;

          return {
            fullName: String(fullName).trim(),
            grade: String(grade).trim(),
            stage: String(stage).trim(),
            groupName: String(groupName).trim(),
            internalId: normalizeStudentCode(String(internalId)),
          };
        });

        resolve(parsed.filter((r) => r.fullName.length > 0));
      } catch (err) {
        reject(err);
      }
    };

    reader.onerror = (err) => reject(err);
    reader.readAsBinaryString(file);
  });
}

export function convertRowsToStudentsWithCredentials(
  rows: ParsedStudentRow[],
  existingStudents: Student[] = []
): { students: Student[]; credentials: EphemeralStudentCredential[] } {
  const usedCodes = new Set(existingStudents.map((s) => normalizeStudentCode(s.internalId)));
  const usedQrTokens = new Set<string>();
  let counter = 1001 + existingStudents.length;
  const now = new Date().toISOString();

  const students: Student[] = [];
  const credentials: EphemeralStudentCredential[] = [];

  rows.forEach((row, idx) => {
    let candidateCode = row.internalId ? normalizeStudentCode(row.internalId) : '';
    while (!candidateCode || usedCodes.has(candidateCode)) {
      candidateCode = `STU-${counter}`;
      counter += 1;
    }
    usedCodes.add(candidateCode);

    const plainPin = generateStudentAccessCode(6);
    const studentId = `stu-${Date.now()}-${idx}`;
    const hashed = hashAccessCodeSync(plainPin);
    const uniqueQr = generateUniqueStudentQrToken(existingStudents, usedQrTokens);
    usedQrTokens.add(uniqueQr);

    const cleanStudent = sanitizeStudentForPersistence({
      id: studentId,
      internalId: candidateCode,
      fullName: row.fullName,
      grade: row.grade,
      stage: row.stage,
      groupName: row.groupName,
      accessCodeHash: hashed,
      accessCodeUpdatedAt: now,
      qrToken: uniqueQr,
      qrTokenStatus: 'active',
      qrLoginEnabled: true,
      qrTokenVersion: 1,
      qrTokenIssuedAt: now,
      status: 'active',
      totalBooksRead: 0,
      currentActiveLoans: 0,
      createdAt: now,
    });

    students.push(cleanStudent);
    credentials.push({
      studentId,
      studentCode: candidateCode,
      fullName: row.fullName,
      grade: row.grade,
      groupName: row.groupName,
      plainAccessCode: plainPin,
      issuedAt: now,
    });
  });

  return { students, credentials };
}

export function convertRowsToStudents(rows: ParsedStudentRow[], existingCount = 0): Student[] {
  const syntheticExisting: Student[] = Array.from({ length: existingCount }, (_, idx) => ({
    id: `existing-${idx}`,
    internalId: `STU-${1001 + idx}`,
    fullName: '',
    grade: '',
    stage: '',
    groupName: '',
    accessCodeHash: '',
    qrToken: '',
    status: 'active',
    totalBooksRead: 0,
    currentActiveLoans: 0,
    createdAt: '',
  }));
  return convertRowsToStudentsWithCredentials(rows, syntheticExisting).students;
}
