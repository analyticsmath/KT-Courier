import { describe, expect, it } from "vitest";
import { assertCategoryParentAllowed, categoryPath } from "@/lib/catalog/category-tree-policy";
describe("category tree policy",()=>{it("builds deterministic paths",()=>expect(categoryPath("/food","Fresh Fruit")).toBe("/food/fresh-fruit"));it("rejects cycles",()=>expect(()=>assertCategoryParentAllowed({categoryId:"a",parentId:"b",categories:[{id:"a",parentId:null,slug:"a"},{id:"b",parentId:"a",slug:"b"}]})).toThrow(/cycle/i));it("rejects archived parents",()=>expect(()=>assertCategoryParentAllowed({parentId:"a",categories:[{id:"a",parentId:null,slug:"a",status:"ARCHIVED"}]})).toThrow(/Archived/));});

