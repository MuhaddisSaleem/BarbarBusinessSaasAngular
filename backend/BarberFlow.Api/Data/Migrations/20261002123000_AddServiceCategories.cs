using BarberFlow.Api.Data;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace BarberFlow.Api.Data.Migrations;

[DbContext(typeof(BarberFlowDbContext))]
[Migration("20261002123000_AddServiceCategories")]
public partial class AddServiceCategories : Migration
{
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.CreateTable(
            name: "ServiceCategories",
            columns: table => new
            {
                Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                SalonId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                PublicId = table.Column<int>(type: "int", nullable: false),
                Name = table.Column<string>(type: "nvarchar(120)", maxLength: 120, nullable: false),
                SortOrder = table.Column<int>(type: "int", nullable: false),
                IsActive = table.Column<bool>(type: "bit", nullable: false),
                CreatedAtUtc = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false),
                UpdatedAtUtc = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false)
            },
            constraints: table =>
            {
                table.PrimaryKey("PK_ServiceCategories", x => x.Id);
                table.ForeignKey(
                    name: "FK_ServiceCategories_Salons_SalonId",
                    column: x => x.SalonId,
                    principalTable: "Salons",
                    principalColumn: "Id",
                    onDelete: ReferentialAction.Cascade);
            });

        migrationBuilder.CreateIndex(
            name: "IX_ServiceCategories_SalonId_IsActive_SortOrder",
            table: "ServiceCategories",
            columns: new[] { "SalonId", "IsActive", "SortOrder" });

        migrationBuilder.CreateIndex(
            name: "IX_ServiceCategories_SalonId_Name",
            table: "ServiceCategories",
            columns: new[] { "SalonId", "Name" },
            unique: true);

        migrationBuilder.CreateIndex(
            name: "IX_ServiceCategories_SalonId_PublicId",
            table: "ServiceCategories",
            columns: new[] { "SalonId", "PublicId" },
            unique: true);

        migrationBuilder.AddColumn<Guid>(
            name: "ServiceCategoryId",
            table: "Services",
            type: "uniqueidentifier",
            nullable: true);

        migrationBuilder.Sql("""
            INSERT INTO ServiceCategories
                (Id, SalonId, PublicId, Name, SortOrder, IsActive, CreatedAtUtc, UpdatedAtUtc)
            SELECT
                NEWID(),
                s.Id,
                1,
                N'Haircut',
                1,
                CAST(1 AS bit),
                SYSDATETIMEOFFSET(),
                SYSDATETIMEOFFSET()
            FROM Salons s
            WHERE NOT EXISTS (
                SELECT 1
                FROM ServiceCategories c
                WHERE c.SalonId = s.Id
            );

            UPDATE svc
            SET ServiceCategoryId = cat.Id
            FROM Services svc
            INNER JOIN ServiceCategories cat
                ON cat.SalonId = svc.SalonId
               AND cat.Name = N'Haircut'
            WHERE svc.ServiceCategoryId IS NULL;
            """);

        migrationBuilder.AlterColumn<Guid>(
            name: "ServiceCategoryId",
            table: "Services",
            type: "uniqueidentifier",
            nullable: false,
            oldClrType: typeof(Guid),
            oldType: "uniqueidentifier",
            oldNullable: true);

        migrationBuilder.CreateIndex(
            name: "IX_Services_ServiceCategoryId",
            table: "Services",
            column: "ServiceCategoryId");

        migrationBuilder.AddForeignKey(
            name: "FK_Services_ServiceCategories_ServiceCategoryId",
            table: "Services",
            column: "ServiceCategoryId",
            principalTable: "ServiceCategories",
            principalColumn: "Id",
            onDelete: ReferentialAction.Restrict);
    }

    protected override void Down(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.DropForeignKey(
            name: "FK_Services_ServiceCategories_ServiceCategoryId",
            table: "Services");

        migrationBuilder.DropIndex(
            name: "IX_Services_ServiceCategoryId",
            table: "Services");

        migrationBuilder.DropColumn(
            name: "ServiceCategoryId",
            table: "Services");

        migrationBuilder.DropTable(
            name: "ServiceCategories");
    }
}
