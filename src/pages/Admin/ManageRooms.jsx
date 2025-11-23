import { useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";

export default function ManageRooms() {
  const [name, setName] = useState("");
  const [capacity, setCapacity] = useState(60);
  const [type, setType] = useState("Lecture");

  const handleSubmit = async (e) => {
    e.preventDefault();
    const { data, error } = await supabase
      .from("rooms")
      .insert([
        { 
          name, 
          capacity: Number(capacity), 
          type 
        }
      ]);

    if (error) {
      alert("Error adding room: " + error.message);
    } else {
      alert("Room added!");
      setName("");
      setCapacity(60);
    }
  };

  return (
    <Card className="max-w-md mx-auto mt-10">
      <CardHeader>
        <CardTitle>Manage Rooms</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="name">Room Name / Number</Label>
            <Input id="name" value={name} onChange={e => setName(e.target.value)} required placeholder="e.g., Room 205" />
          </div>
          <div>
            <Label htmlFor="capacity">Capacity</Label>
            <Input id="capacity" type="number" value={capacity} onChange={e => setCapacity(Number(e.target.value))} required />
          </div>
          <div>
            <Label>Type</Label>
            <Select value={type} onValueChange={setType}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="Lecture">Lecture</SelectItem>
                <SelectItem value="Lab">Lab</SelectItem>
                <SelectItem value="Seminar">Seminar Hall</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Button type="submit" className="w-full">Add Room</Button>
        </form>
      </CardContent>
    </Card>
  );
}