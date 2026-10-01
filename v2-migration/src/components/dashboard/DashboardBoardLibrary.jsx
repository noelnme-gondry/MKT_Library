'use client';
import { useEffect, useRef, useState } from 'react';
import ModalDialog from '@/components/ds/ModalDialog';
import { accountRequest } from '@/lib/account/accountClient';
import { portableBoard, validatePortableBoard, BOARD_MAX_BYTES } from '@/lib/dashboard/boardContract';
import { useAppStore } from '@/store/useDataStore';
import { hasPaidAccess } from '@/lib/subscription/entitlement';
import { downloadFile } from '@/utils/download';

export default function DashboardBoardLibrary({ workspace, paid, locale, onApply, onClose }) {
  const fileInput = useRef(null);
  const t=(ko,en)=>locale==='en'?en:ko;
  const [boards,setBoards]=useState([]),[name,setName]=useState(''),[status,setStatus]=useState(''),[busy,setBusy]=useState(false),[canApply,setCanApply]=useState(false);
  const failure = error => setStatus(error.message==='LOGIN_REQUIRED'?t('계정 저장은 로그인 후 사용할 수 있습니다.','Sign in to save layouts to your account.'):error.message==='PRO_REQUIRED'?t('저장·적용에는 유효한 Pro가 필요합니다.','Saving and applying require active Pro.'):t('처리하지 못했습니다. 로그인 상태나 설정 파일을 확인하세요.','Could not complete the action. Check your account or layout file.'));
  useEffect(()=>{let active=true;accountRequest('boards').then(data=>{if(active){setBoards(data.boards||[]);setCanApply(data.canApply);}}).catch(error=>{if(active)setStatus(error.message==='LOGIN_REQUIRED'?t('로그인하면 기기 간 구성을 불러올 수 있습니다.','Sign in to load layouts across devices.'):t('계정 목록을 불러오지 못했습니다. 파일 공유는 사용할 수 있습니다.','Account layouts unavailable. File sharing is still available.'));});return()=>{active=false};},[locale]); // eslint-disable-line react-hooks/exhaustive-deps
  const run=async action=>{setBusy(true);setStatus('');try{await action();}catch(error){failure(error);}finally{setBusy(false);}};
  const template=()=>{if(!hasPaidAccess(useAppStore.getState().entitlement))throw Error('PRO_REQUIRED');return validatePortableBoard(portableBoard(workspace,name));};
  return <ModalDialog open onClose={onClose} ariaLabel={t('보드 동기화와 팀 공유','Board sync and team sharing')} overlayClassName="dashboard-board-overlay" panelClassName="modal-panel dashboard-board-library">
    <header><h2>{t('보드 동기화와 팀 공유','Board sync and team sharing')}</h2><button className="ab-pill" onClick={onClose}>{t('닫기','Close')}</button></header>
    <p>{t('배치·차트 종류·표준 지표만 전달합니다. 대상 값·날짜·사용자 차트 제목·직접 만든 지표는 기기에 남습니다. 받은 구성은 현재 공통 필터로 적용됩니다.','Only layout, chart types and standard metrics are transferred. Scope values, dates, custom titles and formulas stay on-device. Imported layouts use your current shared filters.')}</p>
    <label className="dashboard-editor-field"><span>{t('구성 이름','Layout name')}</span><input value={name} onChange={e=>setName(e.target.value)} maxLength={40}/></label>
    <div className="dashboard-workspace-actions">
      <button className="btn primary" disabled={!paid||busy||!name.trim()} onClick={()=>run(async()=>{const data=await accountRequest('boards',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({board:template()})});setBoards(data.boards);setCanApply(true);setStatus(t('계정에 저장했습니다. 같은 계정으로 다른 기기에서 불러올 수 있습니다.','Saved to your account. Load it on another device with the same account.'));})}>{t('계정에 저장','Save to account')}</button>
      <button className="ab-pill" disabled={!paid||!name.trim()||busy} onClick={()=>run(async()=>{downloadFile(new Blob([JSON.stringify(template(),null,2)],{type:'application/json'}),'dashboard-layout.gop.json');setStatus(t('설정 파일을 받았습니다. 팀원에게 파일을 전달하면 각자 가져와 사용할 수 있습니다.','Layout downloaded. Send the file to teammates to import their own copy.'));})}>{t('팀 공유 파일 받기','Download team layout')}</button>
      <button className="ab-pill" disabled={!paid||busy} onClick={()=>fileInput.current?.click()}>{t('설정 파일 가져오기','Import layout file')}</button><input ref={fileInput} type="file" accept=".json" hidden disabled={!paid||busy} onChange={e=>{const file=e.target.files?.[0];e.target.value='';if(!file)return;run(async()=>{if(file.size>BOARD_MAX_BYTES)throw Error('INVALID_BOARD');const board=validatePortableBoard(JSON.parse(await file.text()));onApply(board);setStatus(t('편집 미리보기에 적용했습니다. 편집 저장으로 확정하세요.','Applied to the editing preview. Confirm with Save edits.'));});}}/>
    </div>
    <p className="muted">{t('팀 공유는 복사본 전달입니다. 자동 공유·실시간 공동 편집은 하지 않습니다.','Team sharing transfers a copy. It does not publish automatically or provide live collaboration.')}</p>
    <section><h3>{t('계정에 저장한 구성','Account layouts')}</h3>{!boards.length&&<p>{t('아직 저장한 구성이 없습니다.','No account layouts yet.')}</p>}{boards.map(({updatedAt,...board})=><div className="dashboard-board-row" key={board.name}><div><strong>{board.name}</strong><small>{updatedAt?new Date(updatedAt).toLocaleDateString(locale==='en'?'en-US':'ko-KR'):''}</small></div><button className="ab-pill" disabled={!paid||!canApply||busy} onClick={()=>run(async()=>{onApply(validatePortableBoard(board));setStatus(t('미리보기에 적용했습니다. 편집 저장으로 확정하세요.','Applied to preview. Confirm with Save edits.'));})}>{t('미리보기 적용','Apply to preview')}</button><button className="ab-pill" disabled={busy} onClick={()=>run(async()=>{const data=await accountRequest('boards',{method:'DELETE',headers:{'Content-Type':'application/json'},body:JSON.stringify({name:board.name})});setBoards(data.boards);})}>{t('삭제','Delete')}</button></div>)}</section>
    {status&&<p className="dashboard-workspace-notice" role="status">{status}</p>}
  </ModalDialog>;
}
