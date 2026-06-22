-- CreateEnum
CREATE TYPE "CredentialStatus" AS ENUM ('active', 'expired', 'invalid', 'rate_limited', 'revoked');

-- CreateEnum
CREATE TYPE "RunStatus" AS ENUM ('pending', 'running', 'succeeded', 'failed');

-- CreateEnum
CREATE TYPE "NodeExecStatus" AS ENUM ('pending', 'running', 'succeeded', 'failed');

-- CreateEnum
CREATE TYPE "AssetType" AS ENUM ('image', 'video', 'audio', 'document', 'storyboard');

-- CreateTable
CREATE TABLE "team" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "team_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "app_user" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "display_name" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "app_user_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "team_member" (
    "id" TEXT NOT NULL,
    "team_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'owner',

    CONSTRAINT "team_member_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_provider" (
    "code" TEXT NOT NULL,
    "display_name" TEXT NOT NULL,
    "capabilities" TEXT[],
    "key_prefix_hint" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "ai_provider_pkey" PRIMARY KEY ("code")
);

-- CreateTable
CREATE TABLE "ai_model" (
    "id" TEXT NOT NULL,
    "provider_code" TEXT NOT NULL,
    "model_code" TEXT NOT NULL,
    "display_name" TEXT NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "ai_model_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "credential" (
    "id" TEXT NOT NULL,
    "team_id" TEXT NOT NULL,
    "provider_code" TEXT NOT NULL,
    "display_name" TEXT NOT NULL,
    "encrypted_key" BYTEA NOT NULL,
    "encryption_iv" BYTEA NOT NULL,
    "is_free_tier" BOOLEAN NOT NULL DEFAULT false,
    "capabilities" TEXT[],
    "status" "CredentialStatus" NOT NULL DEFAULT 'active',
    "last_verified_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "credential_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "workflow" (
    "id" TEXT NOT NULL,
    "team_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "workflow_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "run" (
    "id" TEXT NOT NULL,
    "workflow_id" TEXT NOT NULL,
    "status" "RunStatus" NOT NULL DEFAULT 'pending',
    "started_at" TIMESTAMP(3),
    "finished_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "run_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "node_execution" (
    "id" TEXT NOT NULL,
    "run_id" TEXT NOT NULL,
    "task_name" TEXT NOT NULL,
    "status" "NodeExecStatus" NOT NULL DEFAULT 'pending',
    "credential_id" TEXT,
    "resolved_model_id" TEXT,
    "input_json" JSONB,
    "output_json" JSONB,
    "cost_credit" DECIMAL(10,4) NOT NULL DEFAULT 0,
    "error_message" TEXT,
    "started_at" TIMESTAMP(3),
    "finished_at" TIMESTAMP(3),

    CONSTRAINT "node_execution_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "asset" (
    "id" TEXT NOT NULL,
    "team_id" TEXT NOT NULL,
    "type" "AssetType" NOT NULL,
    "title" TEXT NOT NULL,
    "content_text" TEXT,
    "source_node_execution_id" TEXT,
    "source_run_id" TEXT,
    "is_favorited" BOOLEAN NOT NULL DEFAULT false,
    "favorited_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "asset_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "app_user_email_key" ON "app_user"("email");

-- CreateIndex
CREATE UNIQUE INDEX "team_member_team_id_user_id_key" ON "team_member"("team_id", "user_id");

-- CreateIndex
CREATE UNIQUE INDEX "ai_model_provider_code_model_code_key" ON "ai_model"("provider_code", "model_code");

-- CreateIndex
CREATE UNIQUE INDEX "credential_team_id_provider_code_display_name_key" ON "credential"("team_id", "provider_code", "display_name");

-- AddForeignKey
ALTER TABLE "team_member" ADD CONSTRAINT "team_member_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "team"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "team_member" ADD CONSTRAINT "team_member_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "app_user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_model" ADD CONSTRAINT "ai_model_provider_code_fkey" FOREIGN KEY ("provider_code") REFERENCES "ai_provider"("code") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "credential" ADD CONSTRAINT "credential_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "team"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "credential" ADD CONSTRAINT "credential_provider_code_fkey" FOREIGN KEY ("provider_code") REFERENCES "ai_provider"("code") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workflow" ADD CONSTRAINT "workflow_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "team"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "run" ADD CONSTRAINT "run_workflow_id_fkey" FOREIGN KEY ("workflow_id") REFERENCES "workflow"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "node_execution" ADD CONSTRAINT "node_execution_run_id_fkey" FOREIGN KEY ("run_id") REFERENCES "run"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "node_execution" ADD CONSTRAINT "node_execution_credential_id_fkey" FOREIGN KEY ("credential_id") REFERENCES "credential"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "node_execution" ADD CONSTRAINT "node_execution_resolved_model_id_fkey" FOREIGN KEY ("resolved_model_id") REFERENCES "ai_model"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "asset" ADD CONSTRAINT "asset_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "team"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "asset" ADD CONSTRAINT "asset_source_node_execution_id_fkey" FOREIGN KEY ("source_node_execution_id") REFERENCES "node_execution"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "asset" ADD CONSTRAINT "asset_source_run_id_fkey" FOREIGN KEY ("source_run_id") REFERENCES "run"("id") ON DELETE SET NULL ON UPDATE CASCADE;
