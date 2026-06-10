import React, { useState } from 'react';
import { X, User } from 'lucide-react';
import { usePlayerStore } from '../store/usePlayerStore';
import { useShallow } from 'zustand/react/shallow';
import type { GroupMember } from '../store/usePlayerStore';
import { apiFetch } from '../apiClient';
import { getProxiedImageUrl } from '../utils/imageUrl';

export const GroupsView: React.FC = () => {
  const { user, groups, setGroups, groupMembers, setGroupMembers } = usePlayerStore(useShallow(state => ({
    user: state.user,
    groups: state.groups,
    setGroups: state.setGroups,
    groupMembers: state.groupMembers,
    setGroupMembers: state.setGroupMembers
  })));
  const [joinGroupCode, setJoinGroupCode] = useState('');
  const [createGroupName, setCreateGroupName] = useState('');

  const handleJoinGroup = async () => {
    if (!joinGroupCode.trim()) return;
    try {
      const res = await apiFetch('/api/groups/join', {
        method: 'POST',
        body: JSON.stringify({ userId: user?.id, inviteCode: joinGroupCode.trim() })
      });
      if (!res.ok) {
        const d = await res.json();
        alert(d.error || 'Ошибка вступления');
        return;
      }
      const data = await res.json();
      setGroups([...groups, data.group]);
      setGroupMembers({ ...groupMembers, [data.group.id]: data.members });
      setJoinGroupCode('');
      alert('Успешно вступили в группу!');
    } catch (e) {
      console.error(e);
      alert('Ошибка при вступлении в группу');
    }
  };

  const handleCreateGroup = async () => {
    if (!createGroupName.trim()) return;
    try {
      const res = await apiFetch('/api/groups', {
        method: 'POST',
        body: JSON.stringify({ userId: user?.id, name: createGroupName.trim() })
      });
      if (!res.ok) throw new Error('Failed to create');
      const data = await res.json();
      setGroups([...groups, data.group]);
      setGroupMembers({ ...groupMembers, [data.group.id]: data.members });
      setCreateGroupName('');
      alert('Группа создана!');
    } catch (e) {
      console.error(e);
      alert('Ошибка при создании группы');
    }
  };

  const handleLeaveGroup = async (groupId: string) => {
    if (!confirm('Вы уверены, что хотите выйти из группы?')) return;
    try {
      await apiFetch(`/api/groups/${groupId}/leave`, { method: 'POST' });
      setGroups(groups.filter(g => g.id !== groupId));
      const newMembers = { ...groupMembers };
      delete newMembers[groupId];
      setGroupMembers(newMembers);
    } catch (e) {
      console.error(e);
      alert('Ошибка при выходе из группы');
    }
  };

  const handleKickMember = async (groupId: string, memberId: string) => {
    if (!confirm('Исключить пользователя?')) return;
    try {
      await apiFetch(`/api/groups/${groupId}/kick`, { 
        method: 'POST',
        body: JSON.stringify({ targetUserId: memberId })
      });
      setGroupMembers({
        ...groupMembers,
        [groupId]: (groupMembers[groupId] || []).filter((m: GroupMember) => m.id !== memberId)
      });
    } catch (e) {
      console.error(e);
      alert('Ошибка исключения');
    }
  };

  return (
    <div style={{ marginBottom: 24, display: 'flex', flexDirection: 'column', gap: 32 }}>
      <div style={{ display: 'flex', gap: 48, flexWrap: 'wrap' }}>
        <div>
          <h4 style={{ marginBottom: 16 }}>Присоединиться к группе</h4>
          <div style={{ display: 'flex', gap: 8 }}>
            <input 
              type="text" 
              placeholder="Код группы" 
              value={joinGroupCode}
              onChange={(e) => setJoinGroupCode(e.target.value)}
              style={{ padding: '12px 16px', borderRadius: 8, border: 'none', backgroundColor: 'var(--color-surface-elevated)', color: 'white', width: 200 }}
            />
            <button onClick={handleJoinGroup} style={{ padding: '12px 24px', borderRadius: 8, backgroundColor: 'var(--color-surface-hover)', fontWeight: 600 }}>
              Вступить
            </button>
          </div>
        </div>
        <div>
          <h4 style={{ marginBottom: 16 }}>Создать новую группу</h4>
          <div style={{ display: 'flex', gap: 8 }}>
            <input 
              type="text" 
              placeholder="Название группы" 
              value={createGroupName}
              onChange={(e) => setCreateGroupName(e.target.value)}
              style={{ padding: '12px 16px', borderRadius: 8, border: 'none', backgroundColor: 'var(--color-surface-elevated)', color: 'white', width: 200 }}
            />
            <button onClick={handleCreateGroup} style={{ padding: '12px 24px', borderRadius: 8, backgroundColor: 'var(--color-accent)', color: 'black', fontWeight: 600 }}>
              Создать
            </button>
          </div>
        </div>
      </div>

      {groups.length > 0 && (
        <div>
          <h3 style={{ marginBottom: 16, fontSize: 24, borderBottom: '1px solid var(--color-divider)', paddingBottom: 16 }}>Ваши группы</h3>
          <div className="groups-grid">
            {groups.map(g => (
              <div key={g.id} className="card" style={{ backgroundColor: 'var(--color-surface-elevated)', padding: 24, borderRadius: 12 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
                  <h4 style={{ fontSize: 20, margin: 0 }}>{g.name}</h4>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div 
                      onClick={() => {
                        const codeToCopy = g.invite_code || (g as any).code || g.id;
                        navigator.clipboard.writeText(codeToCopy);
                        alert('Код группы скопирован!');
                      }}
                      title="Нажмите, чтобы скопировать код"
                      style={{ backgroundColor: 'rgba(255,255,255,0.05)', padding: '4px 8px', borderRadius: 6, fontSize: 12, color: 'var(--color-accent)', letterSpacing: 1, cursor: 'pointer', transition: 'background-color 0.2s' }}
                      onMouseOver={(e) => e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.1)'}
                      onMouseOut={(e) => e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.05)'}
                    >
                      Код: {g.invite_code || (g as any).code || '???'}
                    </div>
                    <button onClick={() => handleLeaveGroup(g.id)} style={{ backgroundColor: 'transparent', border: 'none', color: 'var(--color-text-secondary)', cursor: 'pointer', padding: 4 }} title="Выйти из группы">
                      <X size={16} />
                    </button>
                  </div>
                </div>
                <div style={{ color: 'var(--color-text-secondary)' }}>
                  <h5 style={{ fontSize: 14, marginBottom: 8, color: 'var(--color-text-primary)' }}>Участники:</h5>
                  <ul style={{ paddingLeft: 0, listStyle: 'none', margin: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {(groupMembers[g.id] || []).map((m: GroupMember) => (
                      <li key={m.id} style={{ display: 'flex', alignItems: 'center', gap: 12, fontSize: 14, backgroundColor: 'rgba(0,0,0,0.2)', padding: '8px 12px', borderRadius: 8 }}>
                        {m.avatar_url ? (
                          <img src={getProxiedImageUrl(m.avatar_url)} alt={m.nickname || m.code} style={{ width: 40, height: 40, borderRadius: '50%', objectFit: 'cover' }} />
                        ) : (
                          <div style={{ width: 40, height: 40, borderRadius: '50%', backgroundColor: 'var(--color-surface-hover)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <User size={20} />
                          </div>
                        )}
                        <div style={{ display: 'flex', flexDirection: 'column' }}>
                          <span style={{ fontWeight: 600 }}>{m.nickname || 'Пользователь'} {m.id === user?.id ? '(Вы)' : ''}</span>
                        </div>
                        {g.owner_id === user?.id && m.id !== user?.id && (
                          <button onClick={() => handleKickMember(g.id, m.id)} style={{ marginLeft: 'auto', backgroundColor: 'transparent', border: 'none', color: 'var(--color-text-secondary)', cursor: 'pointer' }} title="Исключить">
                            <X size={16} />
                          </button>
                        )}
                        {g.owner_id === m.id && (
                          <span style={{ marginLeft: 'auto', fontSize: 12, color: 'var(--color-accent)', border: '1px solid var(--color-accent)', padding: '2px 6px', borderRadius: 12 }}>Владелец</span>
                        )}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
