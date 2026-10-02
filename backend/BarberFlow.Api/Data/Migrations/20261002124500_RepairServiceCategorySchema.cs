using BarberFlow.Api.Data;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace BarberFlow.Api.Data.Migrations;

[DbContext(typeof(BarberFlowDbContext))]
[Migration("20261002124500_RepairServiceCategorySchema")]
public partial class RepairServiceCategorySchema : Migration
{
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        // Follow-up safety migration for local databases where the first category
        // upgrade may already be recorded but the schema/backfill is incomplete.
        // No service or barber rows are deleted or replaced.
        migrationBuilder.Sql("""
            IF OBJECT_ID(N'[dbo].[ServiceCategories]', N'U') IS NULL
            BEGIN
                CREATE TABLE [dbo].[ServiceCategories]
                (
                    [Id] uniqueidentifier NOT NULL,
                    [SalonId] uniqueidentifier NOT NULL,
                    [PublicId] int NOT NULL,
                    [Name] nvarchar(120) NOT NULL,
                    [SortOrder] int NOT NULL,
                    [IsActive] bit NOT NULL,
                    [CreatedAtUtc] datetimeoffset NOT NULL,
                    [UpdatedAtUtc] datetimeoffset NOT NULL,
                    CONSTRAINT [PK_ServiceCategories] PRIMARY KEY ([Id])
                );
            END;

            IF COL_LENGTH(N'dbo.Services', N'ServiceCategoryId') IS NULL
            BEGIN
                ALTER TABLE [dbo].[Services]
                    ADD [ServiceCategoryId] uniqueidentifier NULL;
            END;

            INSERT INTO [dbo].[ServiceCategories]
                ([Id], [SalonId], [PublicId], [Name], [SortOrder], [IsActive], [CreatedAtUtc], [UpdatedAtUtc])
            SELECT
                NEWID(),
                salon.[Id],
                ISNULL(
                    (
                        SELECT MAX(existing.[PublicId]) + 1
                        FROM [dbo].[ServiceCategories] existing
                        WHERE existing.[SalonId] = salon.[Id]
                    ),
                    1
                ),
                N'Haircut',
                1,
                CAST(1 AS bit),
                SYSDATETIMEOFFSET(),
                SYSDATETIMEOFFSET()
            FROM [dbo].[Salons] salon
            WHERE NOT EXISTS
            (
                SELECT 1
                FROM [dbo].[ServiceCategories] category
                WHERE category.[SalonId] = salon.[Id]
                  AND LOWER(category.[Name]) = N'haircut'
            );

            UPDATE service
            SET [ServiceCategoryId] = category.[Id]
            FROM [dbo].[Services] service
            INNER JOIN [dbo].[ServiceCategories] category
                ON category.[SalonId] = service.[SalonId]
               AND LOWER(category.[Name]) = N'haircut'
            WHERE service.[ServiceCategoryId] IS NULL;

            IF EXISTS
            (
                SELECT 1
                FROM [dbo].[Services]
                WHERE [ServiceCategoryId] IS NULL
            )
            BEGIN
                THROW 51001, 'Service category repair could not classify every existing service. No service or barber data was deleted.', 1;
            END;

            IF EXISTS
            (
                SELECT 1
                FROM sys.columns
                WHERE [object_id] = OBJECT_ID(N'[dbo].[Services]')
                  AND [name] = N'ServiceCategoryId'
                  AND [is_nullable] = 1
            )
            BEGIN
                ALTER TABLE [dbo].[Services]
                    ALTER COLUMN [ServiceCategoryId] uniqueidentifier NOT NULL;
            END;

            IF NOT EXISTS
            (
                SELECT 1 FROM sys.indexes
                WHERE [name] = N'IX_ServiceCategories_SalonId_IsActive_SortOrder'
                  AND [object_id] = OBJECT_ID(N'[dbo].[ServiceCategories]')
            )
            BEGIN
                CREATE INDEX [IX_ServiceCategories_SalonId_IsActive_SortOrder]
                    ON [dbo].[ServiceCategories] ([SalonId], [IsActive], [SortOrder]);
            END;

            IF NOT EXISTS
            (
                SELECT 1 FROM sys.indexes
                WHERE [name] = N'IX_ServiceCategories_SalonId_Name'
                  AND [object_id] = OBJECT_ID(N'[dbo].[ServiceCategories]')
            )
            BEGIN
                CREATE UNIQUE INDEX [IX_ServiceCategories_SalonId_Name]
                    ON [dbo].[ServiceCategories] ([SalonId], [Name]);
            END;

            IF NOT EXISTS
            (
                SELECT 1 FROM sys.indexes
                WHERE [name] = N'IX_ServiceCategories_SalonId_PublicId'
                  AND [object_id] = OBJECT_ID(N'[dbo].[ServiceCategories]')
            )
            BEGIN
                CREATE UNIQUE INDEX [IX_ServiceCategories_SalonId_PublicId]
                    ON [dbo].[ServiceCategories] ([SalonId], [PublicId]);
            END;

            IF NOT EXISTS
            (
                SELECT 1 FROM sys.indexes
                WHERE [name] = N'IX_Services_ServiceCategoryId'
                  AND [object_id] = OBJECT_ID(N'[dbo].[Services]')
            )
            BEGIN
                CREATE INDEX [IX_Services_ServiceCategoryId]
                    ON [dbo].[Services] ([ServiceCategoryId]);
            END;

            IF NOT EXISTS
            (
                SELECT 1
                FROM sys.foreign_keys
                WHERE [name] = N'FK_ServiceCategories_Salons_SalonId'
                  AND [parent_object_id] = OBJECT_ID(N'[dbo].[ServiceCategories]')
            )
            BEGIN
                ALTER TABLE [dbo].[ServiceCategories] WITH CHECK
                    ADD CONSTRAINT [FK_ServiceCategories_Salons_SalonId]
                    FOREIGN KEY ([SalonId]) REFERENCES [dbo].[Salons] ([Id])
                    ON DELETE CASCADE;
            END;

            IF NOT EXISTS
            (
                SELECT 1
                FROM sys.foreign_keys
                WHERE [name] = N'FK_Services_ServiceCategories_ServiceCategoryId'
                  AND [parent_object_id] = OBJECT_ID(N'[dbo].[Services]')
            )
            BEGIN
                ALTER TABLE [dbo].[Services] WITH CHECK
                    ADD CONSTRAINT [FK_Services_ServiceCategories_ServiceCategoryId]
                    FOREIGN KEY ([ServiceCategoryId])
                    REFERENCES [dbo].[ServiceCategories] ([Id])
                    ON DELETE NO ACTION;
            END;
            """);
    }

    protected override void Down(MigrationBuilder migrationBuilder)
    {
        // Deliberately no-op. This is a repair migration and rolling it back should
        // never remove a user's service/category data.
    }
}
