using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace BarberFlow.Api.Data.Migrations
{
    /// <inheritdoc />
    public partial class BookingApiPersistence : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<long>(
                name: "PublicId",
                table: "Bookings",
                type: "bigint",
                nullable: false,
                defaultValue: 0L)
                .Annotation("SqlServer:Identity", "1, 1");

            migrationBuilder.CreateIndex(
                name: "IX_Bookings_SalonId_PublicId",
                table: "Bookings",
                columns: new[] { "SalonId", "PublicId" },
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_Bookings_SalonId_PublicId",
                table: "Bookings");

            migrationBuilder.DropColumn(
                name: "PublicId",
                table: "Bookings");
        }
    }
}
