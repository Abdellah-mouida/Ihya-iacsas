-- Keep the actor's role readable after account deletion removes the relation.
ALTER TABLE "AuditLog" ADD COLUMN "actorRole" TEXT;
