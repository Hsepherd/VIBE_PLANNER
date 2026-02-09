'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { getGroups, addGroup, removeGroup, editGroup, GROUP_COLORS, type Group } from '@/lib/groups'
import { getTags, addTag, removeTag, editTag, TAG_COLORS, type Tag } from '@/lib/tags'
import { getTeamMembers, addTeamMember, removeTeamMember, editTeamMember } from '@/lib/team-members'
import type { Project } from '@/lib/useSupabaseProjects'
import {
  Plus,
  Trash2,
  Pencil,
  Check,
  X,
  FolderKanban,
  Users,
  Tag as TagIcon,
} from 'lucide-react'

interface ManageOptionsDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  // 專案
  projects: Project[]
  onAddProject: (name: string) => Promise<void>
  onUpdateProject: (id: string, name: string) => Promise<void>
  onDeleteProject: (id: string) => Promise<void>
  // 通知父元件重新載入
  onGroupsChange: () => void
  onTagsChange: () => void
  onMembersChange: () => void
}

// 顏色選擇器
const COLOR_OPTIONS = Object.keys(GROUP_COLORS)

function ColorPicker({ value, onChange }: { value: string; onChange: (color: string) => void }) {
  return (
    <div className="flex gap-1 flex-wrap">
      {COLOR_OPTIONS.map((color) => {
        const colors = GROUP_COLORS[color]
        return (
          <button
            key={color}
            onClick={() => onChange(color)}
            className={`w-5 h-5 rounded-full border-2 transition-all ${colors.bg} ${
              value === color ? 'border-gray-900 scale-110' : 'border-transparent hover:border-gray-400'
            }`}
            title={color}
          />
        )
      })}
    </div>
  )
}

// 專案管理 Tab
function ProjectsTab({ projects, onAdd, onUpdate, onDelete }: {
  projects: Project[]
  onAdd: (name: string) => Promise<void>
  onUpdate: (id: string, name: string) => Promise<void>
  onDelete: (id: string) => Promise<void>
}) {
  const [newName, setNewName] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editName, setEditName] = useState('')

  const handleAdd = async () => {
    if (!newName.trim()) return
    await onAdd(newName.trim())
    setNewName('')
  }

  const handleSave = async (id: string) => {
    if (!editName.trim()) return
    await onUpdate(id, editName.trim())
    setEditingId(null)
  }

  return (
    <div className="space-y-3">
      {/* 新增 */}
      <div className="flex gap-2">
        <Input
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          placeholder="新增專案名稱..."
          className="h-8 text-sm"
          onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
        />
        <Button size="sm" className="h-8 px-3" onClick={handleAdd} disabled={!newName.trim()}>
          <Plus className="h-3.5 w-3.5" />
        </Button>
      </div>
      {/* 列表 */}
      <div className="max-h-[300px] overflow-y-auto space-y-1">
        {projects.filter(p => p.status === 'active').map((project) => (
          <div key={project.id} className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-gray-50 group">
            {editingId === project.id ? (
              <>
                <FolderKanban className="h-3.5 w-3.5 text-violet-500 shrink-0" />
                <Input
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="h-7 text-xs flex-1"
                  autoFocus
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleSave(project.id)
                    if (e.key === 'Escape') setEditingId(null)
                  }}
                />
                <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={() => handleSave(project.id)}>
                  <Check className="h-3.5 w-3.5 text-green-600" />
                </Button>
                <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={() => setEditingId(null)}>
                  <X className="h-3.5 w-3.5" />
                </Button>
              </>
            ) : (
              <>
                <FolderKanban className="h-3.5 w-3.5 text-violet-500 shrink-0" />
                <span className="text-sm flex-1">{project.name}</span>
                <Button
                  variant="ghost" size="sm"
                  className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100"
                  onClick={() => { setEditingId(project.id); setEditName(project.name) }}
                >
                  <Pencil className="h-3 w-3 text-gray-500" />
                </Button>
                <Button
                  variant="ghost" size="sm"
                  className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100"
                  onClick={() => onDelete(project.id)}
                >
                  <Trash2 className="h-3 w-3 text-red-500" />
                </Button>
              </>
            )}
          </div>
        ))}
        {projects.filter(p => p.status === 'active').length === 0 && (
          <div className="text-center text-xs text-gray-400 py-4">尚無專案</div>
        )}
      </div>
    </div>
  )
}

// 組別管理 Tab
function GroupsTab({ onGroupsChange }: { onGroupsChange: () => void }) {
  const [groups, setGroups] = useState<Group[]>(getGroups())
  const [newName, setNewName] = useState('')
  const [newColor, setNewColor] = useState('gray')
  const [editingName, setEditingName] = useState<string | null>(null)
  const [editName, setEditName] = useState('')
  const [editColor, setEditColor] = useState('')

  const refresh = (updated: Group[]) => {
    setGroups(updated)
    onGroupsChange()
  }

  const handleAdd = () => {
    if (!newName.trim()) return
    const updated = addGroup(newName.trim(), newColor)
    refresh(updated)
    setNewName('')
    setNewColor('gray')
  }

  const handleSave = (oldName: string) => {
    if (!editName.trim()) return
    const updated = editGroup(oldName, editName.trim(), editColor)
    refresh(updated)
    setEditingName(null)
  }

  const handleRemove = (name: string) => {
    const updated = removeGroup(name)
    refresh(updated)
  }

  return (
    <div className="space-y-3">
      {/* 新增 */}
      <div className="space-y-2">
        <div className="flex gap-2">
          <Input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="新增組別名稱..."
            className="h-8 text-sm"
            onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
          />
          <Button size="sm" className="h-8 px-3" onClick={handleAdd} disabled={!newName.trim()}>
            <Plus className="h-3.5 w-3.5" />
          </Button>
        </div>
        {newName.trim() && <ColorPicker value={newColor} onChange={setNewColor} />}
      </div>
      {/* 列表 */}
      <div className="max-h-[300px] overflow-y-auto space-y-1">
        {groups.map((group) => {
          const colors = GROUP_COLORS[group.color] || GROUP_COLORS.gray
          return (
            <div key={group.name} className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-gray-50 group/item">
              {editingName === group.name ? (
                <div className="flex-1 space-y-2">
                  <div className="flex gap-2 items-center">
                    <Input
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      className="h-7 text-xs flex-1"
                      autoFocus
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleSave(group.name)
                        if (e.key === 'Escape') setEditingName(null)
                      }}
                    />
                    <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={() => handleSave(group.name)}>
                      <Check className="h-3.5 w-3.5 text-green-600" />
                    </Button>
                    <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={() => setEditingName(null)}>
                      <X className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                  <ColorPicker value={editColor} onChange={setEditColor} />
                </div>
              ) : (
                <>
                  <span className={`px-2 py-0.5 rounded text-xs ${colors.bg} ${colors.text}`}>{group.name}</span>
                  <span className="flex-1" />
                  <Button
                    variant="ghost" size="sm"
                    className="h-6 w-6 p-0 opacity-0 group-hover/item:opacity-100"
                    onClick={() => { setEditingName(group.name); setEditName(group.name); setEditColor(group.color) }}
                  >
                    <Pencil className="h-3 w-3 text-gray-500" />
                  </Button>
                  <Button
                    variant="ghost" size="sm"
                    className="h-6 w-6 p-0 opacity-0 group-hover/item:opacity-100"
                    onClick={() => handleRemove(group.name)}
                  >
                    <Trash2 className="h-3 w-3 text-red-500" />
                  </Button>
                </>
              )}
            </div>
          )
        })}
        {groups.length === 0 && (
          <div className="text-center text-xs text-gray-400 py-4">尚無組別</div>
        )}
      </div>
    </div>
  )
}

// 負責人管理 Tab
function MembersTab({ onMembersChange }: { onMembersChange: () => void }) {
  const [members, setMembers] = useState<string[]>(getTeamMembers())
  const [newName, setNewName] = useState('')
  const [editingName, setEditingName] = useState<string | null>(null)
  const [editName, setEditName] = useState('')

  const refresh = (updated: string[]) => {
    setMembers(updated)
    onMembersChange()
  }

  const handleAdd = () => {
    if (!newName.trim()) return
    const updated = addTeamMember(newName.trim())
    refresh(updated)
    setNewName('')
  }

  const handleSave = (oldName: string) => {
    if (!editName.trim()) return
    const updated = editTeamMember(oldName, editName.trim())
    refresh(updated)
    setEditingName(null)
  }

  const handleRemove = (name: string) => {
    const updated = removeTeamMember(name)
    refresh(updated)
  }

  return (
    <div className="space-y-3">
      {/* 新增 */}
      <div className="flex gap-2">
        <Input
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          placeholder="新增成員名稱..."
          className="h-8 text-sm"
          onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
        />
        <Button size="sm" className="h-8 px-3" onClick={handleAdd} disabled={!newName.trim()}>
          <Plus className="h-3.5 w-3.5" />
        </Button>
      </div>
      {/* 列表 */}
      <div className="max-h-[300px] overflow-y-auto space-y-1">
        {members.map((member) => (
          <div key={member} className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-gray-50 group">
            {editingName === member ? (
              <>
                <Input
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="h-7 text-xs flex-1"
                  autoFocus
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleSave(member)
                    if (e.key === 'Escape') setEditingName(null)
                  }}
                />
                <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={() => handleSave(member)}>
                  <Check className="h-3.5 w-3.5 text-green-600" />
                </Button>
                <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={() => setEditingName(null)}>
                  <X className="h-3.5 w-3.5" />
                </Button>
              </>
            ) : (
              <>
                <span className="text-sm flex-1">{member}</span>
                <Button
                  variant="ghost" size="sm"
                  className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100"
                  onClick={() => { setEditingName(member); setEditName(member) }}
                >
                  <Pencil className="h-3 w-3 text-gray-500" />
                </Button>
                <Button
                  variant="ghost" size="sm"
                  className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100"
                  onClick={() => handleRemove(member)}
                >
                  <Trash2 className="h-3 w-3 text-red-500" />
                </Button>
              </>
            )}
          </div>
        ))}
        {members.length === 0 && (
          <div className="text-center text-xs text-gray-400 py-4">尚無成員</div>
        )}
      </div>
    </div>
  )
}

export function ManageOptionsDialog({
  open,
  onOpenChange,
  projects,
  onAddProject,
  onUpdateProject,
  onDeleteProject,
  onGroupsChange,
  onTagsChange,
  onMembersChange,
}: ManageOptionsDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle>管理選項</DialogTitle>
        </DialogHeader>
        <Tabs defaultValue="projects">
          <TabsList className="w-full">
            <TabsTrigger value="projects" className="flex-1 gap-1">
              <FolderKanban className="h-3.5 w-3.5" />
              專案
            </TabsTrigger>
            <TabsTrigger value="groups" className="flex-1 gap-1">
              <Users className="h-3.5 w-3.5" />
              組別
            </TabsTrigger>
            <TabsTrigger value="members" className="flex-1 gap-1">
              <Users className="h-3.5 w-3.5" />
              負責人
            </TabsTrigger>
          </TabsList>
          <TabsContent value="projects" className="mt-3">
            <ProjectsTab
              projects={projects}
              onAdd={onAddProject}
              onUpdate={onUpdateProject}
              onDelete={onDeleteProject}
            />
          </TabsContent>
          <TabsContent value="groups" className="mt-3">
            <GroupsTab onGroupsChange={onGroupsChange} />
          </TabsContent>
          <TabsContent value="members" className="mt-3">
            <MembersTab onMembersChange={onMembersChange} />
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  )
}
