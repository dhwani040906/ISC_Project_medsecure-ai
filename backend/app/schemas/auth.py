from typing import Literal
from pydantic import BaseModel, EmailStr, Field, ConfigDict

class RegisterRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=12, max_length=128)
    full_name: str | None = Field(default=None, min_length=2, max_length=120)
    username: str | None = Field(default=None, pattern=r"^[A-Za-z][A-Za-z0-9_.-]{2,39}$")

class LoginRequest(BaseModel):
    email: EmailStr
    password: str

class DoctorCreateRequest(RegisterRequest):
    license_reference: str | None = Field(default=None, max_length=100)

class UserOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: str
    email: EmailStr
    role: Literal["patient", "doctor", "admin"]
    full_name: str | None = None
    username: str | None = None
    is_active: bool

class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    expires_in: int
    user: UserOut

class ProfileUpdateRequest(BaseModel):
    full_name: str = Field(min_length=2, max_length=120)
    username: str = Field(pattern=r"^[A-Za-z][A-Za-z0-9_.-]{2,39}$")

class PasswordChangeRequest(BaseModel):
    current_password: str = Field(min_length=1, max_length=1024)
    new_password: str = Field(min_length=12, max_length=128)
