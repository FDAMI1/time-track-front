import { apiFetch } from "@/lib/api";
import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import { queryClient } from "@/lib/queryClient";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { Plus, Search, BookOpen, Pencil, Trash2, ChevronDown, ChevronRight, Users, UserPlus, UserMinus } from "lucide-react";

export default function ClassesPage() {
  const { token, user } = useAuth();
  const { toast } = useToast();
  const [createOpen, setCreateOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [addStudentsOpen, setAddStudentsOpen] = useState(false);
  const [selectedClass, setSelectedClass] = useState<any>(null);
  const [expandedClassId, setExpandedClassId] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  const [form, setForm] = useState({
    className: "",
    teacherId: "",
    students: [] as string[],
  });

  const [editForm, setEditForm] = useState({
    className: "",
    teacherId: "",
    students: [] as string[],
  });

  const [addStudentIds, setAddStudentIds] = useState<string[]>([]);

  const authHeaders = { Authorization: `Bearer ${token}` };

  const { data: classes, isLoading } = useQuery({
    queryKey: ["/api/classes"],
    queryFn: async () => {
      const res = await apiFetch("/api/classes", { headers: authHeaders });
      if (!res.ok) throw new Error("Failed to fetch");
      return res.json();
    },
  });

  const { data: users } = useQuery({
    queryKey: ["/api/users"],
    queryFn: async () => {
      const res = await apiFetch("/api/users", { headers: authHeaders });
      if (!res.ok) throw new Error("Failed to fetch");
      return res.json();
    },
  });

  const teachers = (users || []).filter((u: any) => u.role === "teacher" && u.isActive);
  const students = (users || []).filter((u: any) => u.role === "student" && u.isActive);

  const createClass = useMutation({
    mutationFn: async (data: typeof form) => {
      const res = await apiFetch("/api/classes", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders },
        body: JSON.stringify(data),
      });
      if (!res.ok) { const err = await res.json(); throw new Error(err.message); }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/classes"] });
      setCreateOpen(false);
      setForm({ className: "", teacherId: "", students: [] });
      toast({ title: "Class created successfully" });
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const updateClass = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: any }) => {
      const res = await apiFetch(`/api/classes/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", ...authHeaders },
        body: JSON.stringify(data),
      });
      if (!res.ok) { const err = await res.json(); throw new Error(err.message); }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/classes"] });
      setEditOpen(false);
      toast({ title: "Class updated successfully" });
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const deleteClass = useMutation({
    mutationFn: async (id: string) => {
      const res = await apiFetch(`/api/classes/${id}`, {
        method: "DELETE",
        headers: authHeaders,
      });
      if (!res.ok) throw new Error("Failed to delete");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/classes"] });
      toast({ title: "Class deleted" });
    },
  });

  const addStudents = useMutation({
    mutationFn: async ({ classId, studentIds }: { classId: string; studentIds: string[] }) => {
      const res = await apiFetch(`/api/classes/${classId}/students`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders },
        body: JSON.stringify({ studentIds }),
      });
      if (!res.ok) { const err = await res.json(); throw new Error(err.message); }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/classes"] });
      setAddStudentsOpen(false);
      setAddStudentIds([]);
      toast({ title: "Students added successfully" });
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const removeStudent = useMutation({
    mutationFn: async ({ classId, userId }: { classId: string; userId: string }) => {
      const res = await apiFetch(`/api/classes/${classId}/students/${userId}`, {
        method: "DELETE",
        headers: authHeaders,
      });
      if (!res.ok) throw new Error("Failed to remove student");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/classes"] });
      toast({ title: "Student removed" });
    },
  });

  const openEdit = (cls: any) => {
    setSelectedClass(cls);
    setEditForm({
      className: cls.className,
      teacherId: cls.teacherId?._id || "",
      students: (cls.students || []).map((s: any) => s._id),
    });
    setEditOpen(true);
  };

  const openAddStudents = (cls: any) => {
    setSelectedClass(cls);
    setAddStudentIds([]);
    setAddStudentsOpen(true);
  };

  const toggleExpand = (classId: string) => {
    setExpandedClassId(expandedClassId === classId ? null : classId);
  };

  const filtered = (classes || []).filter((c: any) =>
    c.className.toLowerCase().includes(search.toLowerCase()) ||
    (c.teacherId && `${c.teacherId.firstName} ${c.teacherId.lastName}`.toLowerCase().includes(search.toLowerCase()))
  );

  const isAdmin = user?.role === "org_admin";

  const getAvailableStudentsForAdd = (cls: any) => {
    const existingIds = (cls.students || []).map((s: any) => s._id);
    return students.filter((s: any) => !existingIds.includes(s._id));
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold" data-testid="text-classes-title">Classes</h1>
          <p className="text-muted-foreground">Manage classes, teachers, and students</p>
        </div>
        {isAdmin && (
          <Dialog open={createOpen} onOpenChange={setCreateOpen}>
            <DialogTrigger asChild>
              <Button data-testid="button-create-class">
                <Plus className="w-4 h-4 mr-2" />
                Add Class
              </Button>
            </DialogTrigger>
            <DialogContent className="max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Create New Class</DialogTitle>
              </DialogHeader>
              <form onSubmit={(e) => { e.preventDefault(); createClass.mutate(form); }} className="space-y-4">
                <div>
                  <Label>Class Name</Label>
                  <Input
                    data-testid="input-class-name"
                    value={form.className}
                    onChange={(e) => setForm({ ...form, className: e.target.value })}
                    placeholder="e.g. Mathematics 101"
                    required
                  />
                </div>
                <div>
                  <Label>Teacher</Label>
                  <Select value={form.teacherId} onValueChange={(v) => setForm({ ...form, teacherId: v })}>
                    <SelectTrigger data-testid="select-class-teacher">
                      <SelectValue placeholder="Select a teacher" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">No Teacher</SelectItem>
                      {teachers.map((t: any) => (
                        <SelectItem key={t._id} value={t._id} data-testid={`option-teacher-${t._id}`}>
                          {t.firstName} {t.lastName}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Students</Label>
                  <p className="text-xs text-muted-foreground">Select students to add to this class</p>
                  <div className="max-h-48 overflow-y-auto space-y-1.5 p-3 rounded-md border bg-muted/30">
                    {students.length === 0 ? (
                      <p className="text-sm text-muted-foreground text-center py-2">No students available</p>
                    ) : (
                      students.map((s: any) => (
                        <label key={s._id} className="flex items-center gap-2 cursor-pointer py-1" data-testid={`label-student-create-${s._id}`}>
                          <Checkbox
                            checked={form.students.includes(s._id)}
                            onCheckedChange={(checked) => {
                              setForm((prev) => ({
                                ...prev,
                                students: checked
                                  ? [...prev.students, s._id]
                                  : prev.students.filter((id) => id !== s._id),
                              }));
                            }}
                            data-testid={`checkbox-student-create-${s._id}`}
                          />
                          <span className="text-sm">{s.firstName} {s.lastName}</span>
                          <span className="text-xs text-muted-foreground">({s.username})</span>
                        </label>
                      ))
                    )}
                  </div>
                  {form.students.length > 0 && (
                    <p className="text-xs text-muted-foreground">{form.students.length} student(s) selected</p>
                  )}
                </div>
                <Button type="submit" className="w-full" disabled={createClass.isPending} data-testid="button-submit-class">
                  {createClass.isPending ? "Creating..." : "Create Class"}
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        )}
      </div>

      <div className="flex gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search classes..."
            className="pl-9"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            data-testid="input-search-classes"
          />
        </div>
      </div>

      {isLoading ? (
        <Card><CardContent className="p-6"><Skeleton className="h-64 w-full" /></CardContent></Card>
      ) : filtered.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <BookOpen className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
            <p className="text-muted-foreground">No classes found</p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10"></TableHead>
                  <TableHead>Class Name</TableHead>
                  <TableHead>Teacher</TableHead>
                  <TableHead>Students</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((cls: any) => {
                  const isExpanded = expandedClassId === cls._id;
                  const classStudents = cls.students || [];
                  return (
                    <>
                      <TableRow key={cls._id} data-testid={`row-class-${cls._id}`}>
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => toggleExpand(cls._id)}
                            data-testid={`button-expand-class-${cls._id}`}
                          >
                            {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                          </Button>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <BookOpen className="w-4 h-4 text-muted-foreground" />
                            <span className="font-medium" data-testid={`text-class-name-${cls._id}`}>{cls.className}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          {cls.teacherId ? (
                            <span className="text-sm" data-testid={`text-class-teacher-${cls._id}`}>
                              {cls.teacherId.firstName} {cls.teacherId.lastName}
                            </span>
                          ) : (
                            <span className="text-sm text-muted-foreground">No teacher assigned</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <Badge variant="secondary" data-testid={`badge-student-count-${cls._id}`}>
                            <Users className="w-3 h-3 mr-1" />
                            {classStudents.length} student{classStudents.length !== 1 ? "s" : ""}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex gap-1 justify-end">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => openAddStudents(cls)}
                              data-testid={`button-add-students-${cls._id}`}
                            >
                              <UserPlus className="w-3.5 h-3.5" />
                            </Button>
                            {isAdmin && (
                              <>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => openEdit(cls)}
                                  data-testid={`button-edit-class-${cls._id}`}
                                >
                                  <Pencil className="w-3.5 h-3.5" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="text-destructive"
                                  onClick={() => { if (confirm(`Delete class "${cls.className}"?`)) deleteClass.mutate(cls._id); }}
                                  data-testid={`button-delete-class-${cls._id}`}
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </Button>
                              </>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                      {isExpanded && (
                        <TableRow key={`${cls._id}-expanded`} data-testid={`row-class-expanded-${cls._id}`}>
                          <TableCell colSpan={5} className="bg-muted/30 p-0">
                            <div className="p-4">
                              <div className="flex items-center justify-between gap-2 mb-3 flex-wrap">
                                <h4 className="text-sm font-medium flex items-center gap-2">
                                  <Users className="w-4 h-4" />
                                  Students in {cls.className}
                                </h4>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => openAddStudents(cls)}
                                  data-testid={`button-add-students-expanded-${cls._id}`}
                                >
                                  <UserPlus className="w-3.5 h-3.5 mr-1" />
                                  Add Students
                                </Button>
                              </div>
                              {classStudents.length === 0 ? (
                                <p className="text-sm text-muted-foreground text-center py-4">No students in this class yet</p>
                              ) : (
                                <Table>
                                  <TableHeader>
                                    <TableRow>
                                      <TableHead>Name</TableHead>
                                      <TableHead>Username</TableHead>
                                      <TableHead className="text-right">Actions</TableHead>
                                    </TableRow>
                                  </TableHeader>
                                  <TableBody>
                                    {classStudents.map((s: any) => (
                                      <TableRow key={s._id} data-testid={`row-student-${cls._id}-${s._id}`}>
                                        <TableCell className="text-sm">{s.firstName} {s.lastName}</TableCell>
                                        <TableCell className="text-sm text-muted-foreground">{s.username}</TableCell>
                                        <TableCell className="text-right">
                                          <Button
                                            variant="ghost"
                                            size="icon"
                                            className="text-destructive"
                                            onClick={() => {
                                              if (confirm(`Remove ${s.firstName} ${s.lastName} from this class?`))
                                                removeStudent.mutate({ classId: cls._id, userId: s._id });
                                            }}
                                            disabled={removeStudent.isPending}
                                            data-testid={`button-remove-student-${cls._id}-${s._id}`}
                                          >
                                            <UserMinus className="w-3.5 h-3.5" />
                                          </Button>
                                        </TableCell>
                                      </TableRow>
                                    ))}
                                  </TableBody>
                                </Table>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      )}
                    </>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Class</DialogTitle>
          </DialogHeader>
          <form onSubmit={(e) => {
            e.preventDefault();
            if (selectedClass) {
              const data: any = { ...editForm };
              if (data.teacherId === "none") data.teacherId = null;
              updateClass.mutate({ id: selectedClass._id, data });
            }
          }} className="space-y-4">
            <div>
              <Label>Class Name</Label>
              <Input
                data-testid="input-edit-class-name"
                value={editForm.className}
                onChange={(e) => setEditForm({ ...editForm, className: e.target.value })}
                required
              />
            </div>
            <div>
              <Label>Teacher</Label>
              <Select value={editForm.teacherId || "none"} onValueChange={(v) => setEditForm({ ...editForm, teacherId: v })}>
                <SelectTrigger data-testid="select-edit-class-teacher">
                  <SelectValue placeholder="Select a teacher" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No Teacher</SelectItem>
                  {teachers.map((t: any) => (
                    <SelectItem key={t._id} value={t._id} data-testid={`option-edit-teacher-${t._id}`}>
                      {t.firstName} {t.lastName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Students</Label>
              <div className="max-h-48 overflow-y-auto space-y-1.5 p-3 rounded-md border bg-muted/30">
                {students.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-2">No students available</p>
                ) : (
                  students.map((s: any) => (
                    <label key={s._id} className="flex items-center gap-2 cursor-pointer py-1" data-testid={`label-student-edit-${s._id}`}>
                      <Checkbox
                        checked={editForm.students.includes(s._id)}
                        onCheckedChange={(checked) => {
                          setEditForm((prev) => ({
                            ...prev,
                            students: checked
                              ? [...prev.students, s._id]
                              : prev.students.filter((id) => id !== s._id),
                          }));
                        }}
                        data-testid={`checkbox-student-edit-${s._id}`}
                      />
                      <span className="text-sm">{s.firstName} {s.lastName}</span>
                      <span className="text-xs text-muted-foreground">({s.username})</span>
                    </label>
                  ))
                )}
              </div>
              {editForm.students.length > 0 && (
                <p className="text-xs text-muted-foreground">{editForm.students.length} student(s) selected</p>
              )}
            </div>
            <Button type="submit" className="w-full" disabled={updateClass.isPending} data-testid="button-submit-edit-class">
              {updateClass.isPending ? "Updating..." : "Update Class"}
            </Button>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={addStudentsOpen} onOpenChange={setAddStudentsOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Add Students to {selectedClass?.className}</DialogTitle>
          </DialogHeader>
          {selectedClass && (() => {
            const available = getAvailableStudentsForAdd(selectedClass);
            return (
              <div className="space-y-4">
                <div className="max-h-64 overflow-y-auto space-y-1.5 p-3 rounded-md border bg-muted/30">
                  {available.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-4">All students are already in this class</p>
                  ) : (
                    available.map((s: any) => (
                      <label key={s._id} className="flex items-center gap-2 cursor-pointer py-1" data-testid={`label-student-add-${s._id}`}>
                        <Checkbox
                          checked={addStudentIds.includes(s._id)}
                          onCheckedChange={(checked) => {
                            setAddStudentIds((prev) =>
                              checked ? [...prev, s._id] : prev.filter((id) => id !== s._id)
                            );
                          }}
                          data-testid={`checkbox-student-add-${s._id}`}
                        />
                        <span className="text-sm">{s.firstName} {s.lastName}</span>
                        <span className="text-xs text-muted-foreground">({s.username})</span>
                      </label>
                    ))
                  )}
                </div>
                {addStudentIds.length > 0 && (
                  <p className="text-xs text-muted-foreground">{addStudentIds.length} student(s) selected</p>
                )}
                <Button
                  className="w-full"
                  disabled={addStudentIds.length === 0 || addStudents.isPending}
                  onClick={() => addStudents.mutate({ classId: selectedClass._id, studentIds: addStudentIds })}
                  data-testid="button-submit-add-students"
                >
                  {addStudents.isPending ? "Adding..." : `Add ${addStudentIds.length} Student(s)`}
                </Button>
              </div>
            );
          })()}
        </DialogContent>
      </Dialog>
    </div>
  );
}
