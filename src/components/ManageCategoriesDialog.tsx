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
import { getTeacherConfig } from "@/lib/teachers";

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
    const [newCategoryWeight, setNewCategoryWeight] = useState("0.1");
    const [loading, setLoading] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [editName, setEditName] = useState("");
    const [editWeight, setEditWeight] = useState("");

    // Check if categories are read-only (teacher-specific)
    const isReadOnly = !!getTeacherConfig(subject.teacher || null);

    useEffect(() => {
        if (open) {
            setCategories(subject.categories || []);
        }
    }, [open, subject.categories]);

    // Calculate total weight (sum of all category weights)
    const totalWeight = categories.reduce((sum, cat) => sum + cat.rawWeight, 0);

    const handleAdd = async () => {
        if (!newCategoryName.trim()) return;
        const weight = parseFloat(newCategoryWeight);
        if (isNaN(weight) || weight <= 0 || weight > 1) {
            alert('Weight must be greater than 0 and at most 1 (0 < weight ≤ 1)');
            return;
        }

        // Check if adding this weight would exceed 1.0
        if (totalWeight + weight > 1.0) {
            alert(`Cannot add category: Total weight would exceed 100% (currently ${(totalWeight * 100).toFixed(1)}%)`);
            return;
        }

        setLoading(true);
        try {
            const newCat = await api.createCategory(subject.id, newCategoryName, weight);
            if (newCat) {
                setCategories([...categories, newCat]);
                setNewCategoryName("");
                setNewCategoryWeight("0.1");
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
        if (isNaN(weight) || weight <= 0 || weight > 1) {
            alert('Weight must be greater than 0 and at most 1 (0 < weight ≤ 1)');
            return;
        }

        // Check if updating this weight would exceed 1.0
        const otherCategoriesWeight = categories
            .filter(c => c.id !== id)
            .reduce((sum, cat) => sum + cat.rawWeight, 0);

        if (otherCategoriesWeight + weight > 1.0) {
            alert(`Cannot update category: Total weight would exceed 100% (other categories: ${(otherCategoriesWeight * 100).toFixed(1)}%)`);
            return;
        }

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
                    <DialogTitle>{isReadOnly ? 'View' : 'Manage'} Categories for {subject.name}</DialogTitle>
                    <DialogDescription>
                        {isReadOnly ? (
                            <>Teacher-specific categories (read-only). These categories are defined by {subject.teacher} and cannot be edited.</>
                        ) : (
                            <>Define assessment categories with percentage weights (0.0-1.0). Total weight cannot exceed 100%.</>
                        )}
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-4 py-4">
                    {/* Total Weight Warning */}
                    {totalWeight > 1.0 && (
                        <div className="bg-destructive/10 border border-destructive rounded-lg p-3 flex items-start gap-2">
                            <AlertCircle className="h-4 w-4 text-destructive mt-0.5" />
                            <div className="text-sm text-destructive">
                                <strong>Warning:</strong> Total weight exceeds 100% ({(totalWeight * 100).toFixed(1)}%). Please adjust category weights.
                            </div>
                        </div>
                    )}

                    {/* Total Weight Display */}
                    <div className="bg-muted rounded-lg p-3 text-sm">
                        <span className="font-medium">Total Weight: </span>
                        <span className={totalWeight > 1.0 ? 'text-destructive font-bold' : 'font-medium'}>
                            {(totalWeight * 100).toFixed(1)}%
                        </span>
                        <span className="text-muted-foreground ml-2">
                            ({(1.0 - totalWeight >= 0 ? (1.0 - totalWeight) * 100 : 0).toFixed(1)}% remaining)
                        </span>
                    </div>

                    {/* List Categories */}
                    <div className="space-y-2">
                        <div className={`grid ${isReadOnly ? 'grid-cols-10' : 'grid-cols-12'} gap-2 text-sm font-medium text-muted-foreground mb-2`}>
                            <div className="col-span-6">Name</div>
                            <div className="col-span-4">Weight (%)</div>
                            {!isReadOnly && <div className="col-span-2">Actions</div>}
                        </div>

                        {categories.map((cat) => (
                            <div key={cat.id} className={`grid ${isReadOnly ? 'grid-cols-10' : 'grid-cols-12'} gap-2 items-center`}>
                                {editingId === cat.id && !isReadOnly ? (
                                    <>
                                        <div className="col-span-6">
                                            <Input
                                                value={editName}
                                                onChange={(e) => setEditName(e.target.value)}
                                                className="h-8"
                                            />
                                        </div>
                                        <div className="col-span-4">
                                            <Input
                                                type="number"
                                                value={editWeight}
                                                onChange={(e) => setEditWeight(e.target.value)}
                                                className="h-8"
                                                min="0.001"
                                                max="1"
                                                step="0.01"
                                                placeholder="0.1 = 10%"
                                            />
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
                                        <div className="col-span-6 text-sm">{cat.name}</div>
                                        <div className="col-span-4 text-sm font-medium">
                                            {isReadOnly ? '—' : `${(cat.rawWeight * 100).toFixed(1)}%`}
                                        </div>
                                        {!isReadOnly && (
                                            <div className="col-span-2 flex gap-1">
                                                <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => startEdit(cat)}>
                                                    <Pencil className="h-3 w-3" />
                                                </Button>
                                                <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive" onClick={() => handleDelete(cat.id)}>
                                                    <Trash2 className="h-3 w-3" />
                                                </Button>
                                            </div>
                                        )}
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

                    {!isReadOnly && (
                        <div className="border-t pt-4">
                            <Label className="text-sm font-medium mb-2 block">Add New Category</Label>
                            <div className="grid grid-cols-12 gap-2">
                                <div className="col-span-6">
                                    <Input
                                        placeholder="e.g. Exam, IA"
                                        value={newCategoryName}
                                        onChange={(e) => setNewCategoryName(e.target.value)}
                                    />
                                </div>
                                <div className="col-span-6">
                                    <div className="flex gap-2">
                                        <Input
                                            type="number"
                                            placeholder="0.1 = 10%"
                                            value={newCategoryWeight}
                                            onChange={(e) => setNewCategoryWeight(e.target.value)}
                                            min="0.001"
                                            max="1"
                                            step="0.01"
                                        />
                                        <Button onClick={handleAdd} disabled={loading || !newCategoryName} className="whitespace-nowrap">
                                            <Plus className="h-4 w-4 mr-2" /> Add
                                        </Button>
                                    </div>
                                </div>
                            </div>
                            <p className="text-xs text-muted-foreground mt-2">
                                <AlertCircle className="h-3 w-3 inline mr-1" />
                                Enter weights as decimals (0.1 = 10%, 0.25 = 25%, etc.). Total cannot exceed 1.0 (100%). Uncategorized assessments get the remaining weight.
                            </p>
                        </div>
                    )}
                </div>

                <DialogFooter>
                    <Button variant="outline" onClick={() => onOpenChange(false)}>Close</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
