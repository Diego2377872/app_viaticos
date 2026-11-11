/** Flujos de usuario sobre registros (abrir formulario, detalle). Evita dependencias circulares. */
import * as actions from './actions.js';
import { openRecordForm } from '../components/recordForm.js';
import { openRecordDetail } from '../components/recordDetail.js';

export function openNew() { openRecordForm({ record: null }); }
export function openEdit(record) { openRecordForm({ record }); }

export function openDetail(record, initialTab = 'general') {
  openRecordDetail(record, {
    initialTab,
    onEdit: (r) => openEdit(r),
    onDelete: (r) => actions.deleteRecords([r.id]),
  });
}
