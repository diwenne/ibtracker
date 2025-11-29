import { useState, useEffect } from "react";
import { Plus, Trash2, Save, X, AlertCircle, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Subject, Category } from "@/lib/types";
import { api } from "@/lib/api";
import { normalizeWeights } from "@/lib/prediction";

interface ManageCategoriesDialogProps {
    subject: Subject;
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onUpdate: () => void; // Refresh subjects
}

export function ManageCategoriesDialog({
    subject,
    open,
    onOpenChange,
    onUpdate,
}: ManageCategoriesDialogProps) {
    const [categories, setCategories] = useState<Category[]>([]);
    const [newCategoryName, setNewCategoryName] = useState("");
    const [newCategoryWeight, setNewCategoryWeight] = useState("1");
    const [loading, setLoading] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [editName, setEditName] = useState("");
    const [editWeight, setEditWeight] = useState("");

    useEffect(() => {
        if (open) {
            setCategories(subject.categories || []);
        }
    }, [open, subject.categories]);

    const normalized = normalizeWeights(categories);

    const handleAdd = async () => {
        if (!newCategoryName.trim()) return;
        const weight = parseFloat(newCategoryWeight);
        if (isNaN(weight) || weight <= 0) return;

        setLoading(true);
        try {
            const newCat = await api.createCategory(subject.id, newCategoryName, weight);
            if (newCat) {
                setCategories([...categories, newCat]);
                setNewCategoryName("");
                setNewCategoryWeight("1");
                onUpdate();
            }
        } finally {
            setLoading(false);
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm("Are you sure? Assessments in this category will become uncategorized.")) return;
        setLoading(true);
        try {
            await api.deleteCategory(id);
            setCategories(categories.filter((c) => c.id !== id));
            onUpdate();
        } finally {
            setLoading(false);
        }
    };

    const startEdit = (cat: Category) => {
        setEditingId(cat.id);
        setEditName(cat.name);
        setEditWeight(cat.rawWeight.toString());
    };

    const cancelEdit = () => {
        setEditingId(null);
        setEditName("");
        setEditWeight("");
    };

    const saveEdit = async (id: string) => {
        if (!editName.trim()) return;
        const weight = parseFloat(editWeight);
        if (isNaN(weight) || weight <= 0) return;

        setLoading(true);
        try {
            const updated = await api.updateCategory(id, editName, weight);
            if (updated) {
                setCategories(categories.map((c) => (c.id === id ? updated : c)));
                setEditingId(null);
                onUpdate();
            }
        } finally {
            setLoading(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[600px]">
                <DialogHeader>
                    <DialogTitle>Manage Categories for {subject.name}</DialogTitle>
                    <DialogDescription>
                        Define assessment categories and their relative weights. Weights are automatically normalized to sum to 100%.
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-4 py-4">
                    {/* List Categories */}
                    <div className="space-y-2">
                        <div className="grid grid-cols-12 gap-2 text-sm font-medium text-muted-foreground mb-2">
                            <div className="col-span-5">Name</div>
                            <div className="col-span-3">Raw Weight</div>
                            <div className="col-span-2">Normalized</div>
                            <div className="col-span-2">Actions</div>
                        </div>

                        {categories.map((cat) => (
                            <div key={cat.id} className="grid grid-cols-12 gap-2 items-center">
                                {editingId === cat.id ? (
                                    <>
                                        <div className="col-span-5">
                                            <Input
                                                value={editName}
                                                onChange={(e) => setEditName(e.target.value)}
                                                className="h-8"
                                            />
                                        </div>
                                        <div className="col-span-3">
                                            <Input
                                                type="number"
                                                value={editWeight}
                                                onChange={(e) => setEditWeight(e.target.value)}
                                                className="h-8"
                                                min="0.1"
                                                step="0.1"
                                            />
                                        </div>
                                        <div className="col-span-2 text-sm text-muted-foreground">
                                            -
                                        </div>
                                        <div className="col-span-2 flex gap-1">
                                            <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => saveEdit(cat.id)} disabled={loading}>
                                                <Save className="h-4 w-4" />
                                            </Button>
                                            <Button size="icon" variant="ghost" className="h-8 w-8" onClick={cancelEdit} disabled={loading}>
                                                <X className="h-4 w-4" />
                                            </Button>
                                        </div>
                                    </>
                                ) : (
                                    <>
                                        <div className="col-span-5 text-sm">{cat.name}</div>
                                        <div className="col-span-3 text-sm">{cat.rawWeight}</div>
                                        <div className="col-span-2 text-sm font-medium">
                                            {((normalized[cat.id] || 0) * 100).toFixed(1)}%
                                        </div>
                                        <div className="col-span-2 flex gap-1">
                                            <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => startEdit(cat)}>
                                                <Pencil className="h-3 w-3" /> // Note: Pencil is not imported, using Edit icon or similar?
                                                {/* Wait, I imported Pencil in page.tsx but not here. Let's check imports. */}
                                            </Button>
                                            <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive" onClick={() => handleDelete(cat.id)}>
                                                <Trash2 className="h-3 w-3" />
                                            </Button>
                                        </div>
                                    </>
                                )}
                            </div>
                        ))}

                        {categories.length === 0 && (
                            <div className="text-center py-4 text-muted-foreground text-sm">
                                No categories defined. All assessments will have equal weight.
                            </div>
                        )}
                    </div>

                    <div className="border-t pt-4">
                        <Label className="text-sm font-medium mb-2 block">Add New Category</Label>
                        <div className="grid grid-cols-12 gap-2">
                            <div className="col-span-5">
                                <Input
                                    placeholder="e.g. Exam, IA"
                                    value={newCategoryName}
                                    onChange={(e) => setNewCategoryName(e.target.value)}
                                />
                            </div>
                            <div className="col-span-3">
                                <Input
                                    type="number"
                                    placeholder="Weight"
                                    value={newCategoryWeight}
                                    onChange={(e) => setNewCategoryWeight(e.target.value)}
                                    min="0.1"
                                    step="0.1"
                                />
                            </div>
                            <div className="col-span-4">
                                <Button onClick={handleAdd} disabled={loading || !newCategoryName} className="w-full">
                                    <Plus className="h-4 w-4 mr-2" /> Add
                                </Button>
                            </div>
                        </div>
                        <p className="text-xs text-muted-foreground mt-2">
                            <AlertCircle className="h-3 w-3 inline mr-1" />
                            Raw weights are relative. If you have "Exam" (2) and "Quiz" (1), Exams are worth 2x Quizzes.
                        </p>
                    </div>
                </div>

                <DialogFooter>
                    <Button variant="outline" onClick={() => onOpenChange(false)}>Close</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
