"use client";

import { useEffect, useState, useTransition } from "react";
import { useLocale, useTranslations } from "next-intl";
import {
  deleteAnnouncementAction,
  listAdminAnnouncementsAction,
  saveAnnouncementAction,
  type AnnouncementDTO,
} from "@/actions/announcements";
import {
  addAdminUserAction,
  listAdminUsersAction,
  removeAdminUserAction,
} from "@/actions/admin-users";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";

function toDateTimeLocalValue(iso: string): string {
  const date = new Date(iso);
  const pad = (v: number) => String(v).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function fromDateTimeLocalValue(value: string): string {
  return new Date(value).toISOString();
}

export function AnnouncementsAdminContent() {
  const t = useTranslations("admin");
  const tCommon = useTranslations("common");
  const locale = useLocale();
  const [isPending, startTransition] = useTransition();

  const [items, setItems] = useState<AnnouncementDTO[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);

  const [titleBn, setTitleBn] = useState("");
  const [titleEn, setTitleEn] = useState("");
  const [bodyBn, setBodyBn] = useState("");
  const [bodyEn, setBodyEn] = useState("");
  const [startAt, setStartAt] = useState("");
  const [endAt, setEndAt] = useState("");

  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [adminUsers, setAdminUsers] = useState<Array<{ userId: string; createdAt: string }>>([]);
  const [newAdminUserId, setNewAdminUserId] = useState("");
  const dateTimeLocale = locale.startsWith("bn") ? "bn-BD-u-nu-beng" : "en-US";

  useEffect(() => {
    startTransition(async () => {
      const [res, usersRes] = await Promise.all([
        listAdminAnnouncementsAction(),
        listAdminUsersAction(),
      ]);
      if (!res.ok || !usersRes.ok) {
        setError(t("loadError"));
        return;
      }
      setItems(res.data);
      setAdminUsers(usersRes.data);
    });
  }, [t]);

  const resetForm = () => {
    setEditingId(null);
    setTitleBn("");
    setTitleEn("");
    setBodyBn("");
    setBodyEn("");
    setStartAt("");
    setEndAt("");
  };

  const save = () => {
    if (!titleBn.trim() || !bodyBn.trim() || !startAt) {
      setError(t("required"));
      return;
    }

    setError(null);
    startTransition(async () => {
      const res = await saveAnnouncementAction({
        id: editingId ?? undefined,
        titleBn: titleBn.trim(),
        titleEn: titleEn.trim(),
        bodyBn: bodyBn.trim(),
        bodyEn: bodyEn.trim(),
        startAt: fromDateTimeLocalValue(startAt),
        endAt: endAt ? fromDateTimeLocalValue(endAt) : null,
      });

      if (!res.ok) {
        setError(t("saveError"));
        return;
      }

      const listRes = await listAdminAnnouncementsAction();
      if (listRes.ok) {
        setItems(listRes.data);
      }

      resetForm();
      setStatus(t("saved"));
    });
  };

  const edit = (item: AnnouncementDTO) => {
    setEditingId(item.id);
    setTitleBn(item.titleBn);
    setTitleEn(item.titleEn);
    setBodyBn(item.bodyBn);
    setBodyEn(item.bodyEn);
    setStartAt(toDateTimeLocalValue(item.startAt));
    setEndAt(item.endAt ? toDateTimeLocalValue(item.endAt) : "");
  };

  const remove = (id: string) => {
    setError(null);
    startTransition(async () => {
      const res = await deleteAnnouncementAction(id);
      if (!res.ok) {
        setError(t("deleteError"));
        return;
      }
      setItems((prev) => prev.filter((item) => item.id !== id));
      setStatus(t("deleted"));
    });
  };

  const addAdmin = () => {
    const userId = newAdminUserId.trim();
    if (!userId) return;

    setError(null);
    startTransition(async () => {
      const res = await addAdminUserAction(userId);
      if (!res.ok) {
        if (res.error === "user_not_found") {
          setError(t("adminUserNotFound"));
          return;
        }
        setError(t("adminUserSaveError"));
        return;
      }

      const usersRes = await listAdminUsersAction();
      if (usersRes.ok) {
        setAdminUsers(usersRes.data);
      }
      setNewAdminUserId("");
      setStatus(t("adminUserSaved"));
    });
  };

  const removeAdmin = (userId: string) => {
    setError(null);
    startTransition(async () => {
      const res = await removeAdminUserAction(userId);
      if (!res.ok) {
        if (res.error === "cannot_remove_self") {
          setError(t("adminCannotRemoveSelf"));
          return;
        }
        setError(t("adminUserDeleteError"));
        return;
      }

      setAdminUsers((prev) => prev.filter((item) => item.userId !== userId));
      setStatus(t("adminUserDeleted"));
    });
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold tracking-tight">{t("title")}</h1>

      {error && (
        <p className="text-sm text-destructive bg-destructive/10 rounded-md px-3 py-2">
          {error}
        </p>
      )}
      {status && (
        <p className="text-sm text-emerald-700 bg-emerald-100 rounded-md px-3 py-2">
          {status}
        </p>
      )}

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">{t("editor")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <Input value={titleBn} onChange={(e) => setTitleBn(e.target.value)} placeholder={t("titleBn")} />
          <Input value={titleEn} onChange={(e) => setTitleEn(e.target.value)} placeholder={t("titleEn")} />

          <textarea
            value={bodyBn}
            onChange={(e) => setBodyBn(e.target.value)}
            placeholder={t("bodyBn")}
            className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            rows={3}
          />
          <textarea
            value={bodyEn}
            onChange={(e) => setBodyEn(e.target.value)}
            placeholder={t("bodyEn")}
            className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            rows={3}
          />

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1">
              <Label>{t("startAt")}</Label>
              <Input type="datetime-local" value={startAt} onChange={(e) => setStartAt(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>{t("endAt")}</Label>
              <Input type="datetime-local" value={endAt} onChange={(e) => setEndAt(e.target.value)} />
            </div>
          </div>

          <div className="flex gap-2">
            <Button onClick={save} disabled={isPending}>{tCommon("save")}</Button>
            {editingId && (
              <Button variant="outline" onClick={resetForm} disabled={isPending}>{tCommon("cancel")}</Button>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">{t("list")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {items.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t("empty")}</p>
          ) : (
            items.map((item) => (
              <div key={item.id} className="rounded-lg border p-3 space-y-2">
                <p className="text-sm font-medium">{item.titleBn}</p>
                <p className="text-xs text-muted-foreground">{item.bodyBn}</p>
                <p className="text-xs text-muted-foreground">
                  {new Date(item.startAt).toLocaleString(dateTimeLocale)} {item.endAt ? `→ ${new Date(item.endAt).toLocaleString(dateTimeLocale)}` : ""}
                </p>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={() => edit(item)}>{tCommon("edit")}</Button>
                  <Button variant="destructive" size="sm" onClick={() => remove(item.id)}>{tCommon("delete")}</Button>
                </div>
              </div>
            ))
          )}
          <Separator />
          <p className="text-xs text-muted-foreground">{t("accessNote")}</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">{t("adminUsersTitle")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex gap-2">
            <Input
              value={newAdminUserId}
              onChange={(e) => setNewAdminUserId(e.target.value)}
              placeholder={t("adminUserIdPlaceholder")}
            />
            <Button onClick={addAdmin} disabled={isPending}>
              {t("addAdminUser")}
            </Button>
          </div>

          {adminUsers.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t("adminUsersEmpty")}</p>
          ) : (
            <div className="space-y-2">
              {adminUsers.map((item) => (
                <div key={item.userId} className="rounded-lg border p-3 space-y-2">
                  <p className="text-xs font-mono break-all">{item.userId}</p>
                  <p className="text-xs text-muted-foreground">
                    {new Date(item.createdAt).toLocaleString(dateTimeLocale)}
                  </p>
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => removeAdmin(item.userId)}
                    disabled={isPending}
                  >
                    {t("removeAdminUser")}
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
